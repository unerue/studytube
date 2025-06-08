import json
import os
from pathlib import Path
from sqlmodel import Session, select
from fastapi import HTTPException, status, BackgroundTasks

from src.models.video import Video
from src.models.transcript import Transcript
from src.models.audio import Audio
from src.utils.filesystem import (
    get_transcript_path, get_audio_path, get_ko_audio_path,
    get_video_transcript_dir, get_video_audio_dir
)
from src.utils.media import extract_audio, get_audio_duration
from src.services.openai_service import transcribe_audio, translate_text, answer_question
from src.services.tts_service import generate_tts, generate_tts_for_segments
from src.controllers.video_controller import update_video_processing_status


async def process_video_audio(db: Session, video_id: int) -> Audio:
    """
    비디오에서 오디오를 추출하여 저장합니다.

    Args:
        db: 데이터베이스 세션
        video_id: 비디오 ID

    Returns:
        Audio: 저장된 오디오 객체
    """
    # 비디오 정보 가져오기
    statement = select(Video).where(Video.id == video_id)
    video = db.execute(statement).scalars().first()

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="비디오를 찾을 수 없습니다."
        )

    # 이미 처리된 오디오가 있는지 확인
    audio_statement = select(Audio).where(
        Audio.video_id == video_id,
        Audio.language == "ko"
    )
    existing_audio = db.execute(audio_statement).scalars().first()

    if existing_audio and existing_audio.is_processed:
        return existing_audio

    # 오디오 파일 경로 설정
    audio_path = str(get_ko_audio_path(video_id))

    # 비디오에서 오디오 추출
    success = extract_audio(video.url, audio_path)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="오디오 추출에 실패했습니다."
        )

    # 오디오 길이 가져오기
    duration = get_audio_duration(audio_path)

    # DB에 오디오 정보 저장
    if existing_audio:
        # 기존 오디오 정보 업데이트
        existing_audio.file_path = audio_path
        existing_audio.duration = duration
        existing_audio.is_processed = True
        db.add(existing_audio)
        db.commit()
        db.refresh(existing_audio)
        return existing_audio
    else:
        # 새 오디오 정보 생성
        new_audio = Audio(
            video_id=video_id,
            language="ko",
            file_path=audio_path,
            duration=duration,
            is_processed=True
        )
        db.add(new_audio)
        db.commit()
        db.refresh(new_audio)
        return new_audio

async def process_video_transcript(db: Session, video_id: int, language: str = "ko") -> Transcript:
    """
    비디오 자막을 생성하여 저장합니다.

    Args:
        db: 데이터베이스 세션
        video_id: 비디오 ID
        language: 언어 코드 (기본값: "ko"은 비디오 원본 언어)

    Returns:
        Transcript: 저장된 자막 객체
    """
    # 먼저 오디오 처리
    audio = await process_video_audio(db, video_id)

    # 이미 처리된 자막이 있는지 확인
    transcript_statement = select(Transcript).where(
        Transcript.video_id == video_id,
        Transcript.language == language
    )
    existing_transcript = db.execute(transcript_statement).scalars().first()

    if existing_transcript and existing_transcript.is_processed:
        return existing_transcript

    # 자막 파일 경로 설정
    transcript_path = str(get_transcript_path(video_id, language))

    # Whisper API로 자막 생성
    whisper_result = await transcribe_audio(audio.file_path, language if language != "ko" else None)

    # 자막 파일 저장
    os.makedirs(os.path.dirname(transcript_path), exist_ok=True)
    with open(transcript_path, "w", encoding="utf-8") as f:
        json.dump({
            "text": whisper_result.text,
            "segments": whisper_result.segments,
            "language": whisper_result.language
        }, f, ensure_ascii=False, indent=2)

    # DB에 자막 정보 저장
    if existing_transcript:
        # 기존 자막 정보 업데이트
        existing_transcript.content = whisper_result.text
        existing_transcript.timestamps = json.dumps(whisper_result.segments)
        existing_transcript.file_path = transcript_path
        existing_transcript.is_processed = True
        db.add(existing_transcript)
        db.commit()
        db.refresh(existing_transcript)
        return existing_transcript
    else:
        # 새 자막 정보 생성
        new_transcript = Transcript(
            video_id=video_id,
            language=language,
            content=whisper_result.text,
            timestamps=json.dumps(whisper_result.segments),
            file_path=transcript_path,
            is_processed=True
        )
        db.add(new_transcript)
        db.commit()
        db.refresh(new_transcript)
        return new_transcript

async def translate_video_transcript(db: Session, video_id: int, source_lang: str, target_lang: str) -> Transcript:
    """
    비디오 자막을 번역하여 저장합니다.

    Args:
        db: 데이터베이스 세션
        video_id: 비디오 ID
        source_lang: 원본 언어 코드
        target_lang: 대상 언어 코드

    Returns:
        Transcript: 번역된 자막 객체
    """
    # 원본 자막 가져오기
    source_transcript_statement = select(Transcript).where(
        Transcript.video_id == video_id,
        Transcript.language == source_lang
    )
    source_transcript = db.execute(source_transcript_statement).scalars().first()

    if not source_transcript or not source_transcript.is_processed:
        # 원본 자막이 없으면 생성
        source_transcript = await process_video_transcript(db, video_id, source_lang)

    # 이미 번역된 자막이 있는지 확인
    target_transcript_statement = select(Transcript).where(
        Transcript.video_id == video_id,
        Transcript.language == target_lang
    )
    target_transcript = db.execute(target_transcript_statement).scalars().first()

    if target_transcript and target_transcript.is_processed:
        return target_transcript

    # 자막 파일 로드
    with open(source_transcript.file_path, "r", encoding="utf-8") as f:
        transcript_data = json.load(f)

    # 원본 자막 텍스트
    source_text = transcript_data.get("text", "")
    source_segments = transcript_data.get("segments", [])

    # 전체 텍스트 번역 (기존 방식)
    translated_text = await translate_text(source_text, "한국어" if target_lang == "ko" else "영어")

    # 세그먼트별 번역 (개선된 방식)
    translated_segments = []
    try:
        print(f"세그먼트별 번역 시작 - 총 {len(source_segments)}개 세그먼트")
        for i, segment in enumerate(source_segments):
            segment_text = segment.get("text", "").strip()
            if segment_text:  # 비어있지 않은 세그먼트만 번역
                translated_segment_text = await translate_text(
                    segment_text,
                    "한국어" if target_lang == "ko" else "영어"
                )
                # 타임스탬프와 ID 유지하면서 세그먼트 복사
                translated_segment = segment.copy()
                translated_segment["text"] = translated_segment_text
                translated_segments.append(translated_segment)
                print(f"세그먼트 {i+1}/{len(source_segments)} 번역 완료")
            else:
                # 비어있는 세그먼트는 그대로 유지
                translated_segments.append(segment)
        print("모든 세그먼트 번역 완료")
    except Exception as e:
        print(f"세그먼트별 번역 중 오류 발생: {str(e)}")
        print("전체 텍스트 번역만 사용합니다.")
        # 오류 발생 시 원본 세그먼트 재사용
        translated_segments = source_segments

    translated_data = {
        "text": translated_text,
        "segments": translated_segments,
        "language": target_lang
    }

    # 번역된 자막 파일 저장
    target_transcript_path = str(get_transcript_path(video_id, target_lang))
    os.makedirs(os.path.dirname(target_transcript_path), exist_ok=True)

    with open(target_transcript_path, "w", encoding="utf-8") as f:
        json.dump(translated_data, f, ensure_ascii=False, indent=2)

    # DB에 번역된 자막 정보 저장
    if target_transcript:
        # 기존 자막 정보 업데이트
        target_transcript.content = translated_text
        target_transcript.timestamps = json.dumps(translated_data.get("segments", []))
        target_transcript.file_path = target_transcript_path
        target_transcript.is_processed = True
        db.add(target_transcript)
        db.commit()
        db.refresh(target_transcript)
        return target_transcript
    else:
        # 새 자막 정보 생성
        new_transcript = Transcript(
            video_id=video_id,
            language=target_lang,
            content=translated_text,
            timestamps=json.dumps(translated_data.get("segments", [])),
            file_path=target_transcript_path,
            is_processed=True
        )
        db.add(new_transcript)
        db.commit()
        db.refresh(new_transcript)
        return new_transcript

async def generate_audio_from_transcript(db: Session, video_id: int, language: str) -> Audio:
    """
    자막에서 TTS로 오디오를 생성합니다.

    Args:
        db: 데이터베이스 세션
        video_id: 비디오 ID
        language: 언어 코드

    Returns:
        Audio: 생성된 오디오 객체
    """
    # 자막 가져오기
    transcript_statement = select(Transcript).where(
        Transcript.video_id == video_id,
        Transcript.language == language
    )
    transcript = db.execute(transcript_statement).scalars().first()

    if not transcript or not transcript.is_processed:
        # 자막이 없으면 번역 또는 생성
        if language == "ko":
            transcript = await process_video_transcript(db, video_id, language)
        else:
            transcript = await translate_video_transcript(db, video_id, "ko", language)

    # 이미 생성된 TTS가 있는지 확인
    audio_statement = select(Audio).where(
        Audio.video_id == video_id,
        Audio.language == language
    )
    existing_audio = db.execute(audio_statement).scalars().first()

    if existing_audio and existing_audio.is_processed and os.path.exists(existing_audio.file_path):
        return existing_audio

    # 자막 데이터 로드
    with open(transcript.file_path, "r", encoding="utf-8") as f:
        transcript_data = json.load(f)

    # TTS 오디오 파일 경로
    tts_audio_path = str(get_audio_path(video_id, language))

    # TTS 생성
    success = generate_tts_for_segments(
        transcript_data.get("segments", []),
        language,
        tts_audio_path
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="TTS 생성에 실패했습니다."
        )

    # 오디오 길이 가져오기
    duration = get_audio_duration(tts_audio_path)

    # DB에 오디오 정보 저장
    if existing_audio:
        # 기존 오디오 정보 업데이트
        existing_audio.file_path = tts_audio_path
        existing_audio.duration = duration
        existing_audio.is_processed = True
        db.add(existing_audio)
        db.commit()
        db.refresh(existing_audio)
        return existing_audio
    else:
        # 새 오디오 정보 생성
        new_audio = Audio(
            video_id=video_id,
            language=language,
            file_path=tts_audio_path,
            duration=duration,
            is_processed=True
        )
        db.add(new_audio)
        db.commit()
        db.refresh(new_audio)
        return new_audio

async def ask_video_question(db: Session, video_id: int, question: str, language: str = "ko") -> dict:
    """
    비디오 내용에 대한 질문에 답변합니다.

    Args:
        db: 데이터베이스 세션
        video_id: 비디오 ID
        question: 사용자 질문
        language: 언어 코드 (기본값: "ko")

    Returns:
        dict: 답변 정보
    """
    # 자막 가져오기
    transcript_statement = select(Transcript).where(
        Transcript.video_id == video_id,
        Transcript.language == language
    )
    transcript = db.execute(transcript_statement).scalars().first()

    if not transcript or not transcript.is_processed:
        # 자막이 없으면 번역 또는 생성
        if language == "ko":
            transcript = await process_video_transcript(db, video_id, language)
        else:
            transcript = await translate_video_transcript(db, video_id, "ko", language)

    # 자막 데이터 로드
    with open(transcript.file_path, "r", encoding="utf-8") as f:
        transcript_data = json.load(f)

    # 질문에 답변
    answer_text = await answer_question(transcript_data.get("text", ""), question)

    return {
        "question": question,
        "answer": answer_text,
        "language": language
    }

async def process_video_complete(db: Session, video_id: int, target_language: str = "ko"):
    """
    비디오의 모든 AI 처리를 순차적으로 진행합니다.

    Args:
        db: 데이터베이스 세션
        video_id: 비디오 ID
        target_language: 대상 언어 코드 (기본값: "ko" - 한국어)
    """
    try:
        print(f"비디오 {video_id} AI 처리 시작")

        # 1. 오디오 추출
        audio = await process_video_audio(db, video_id)
        print(f"비디오 {video_id} 오디오 추출 완료")

        # 2. 원본 자막 생성
        transcript = await process_video_transcript(db, video_id)
        print(f"비디오 {video_id} 원본 자막 생성 완료")

        # 원본이 아닌 다른 언어로 처리하는 경우에만 번역 진행
        if target_language != "ko":
            # 3. 대상 언어로 자막 번역
            target_transcript = await translate_video_transcript(db, video_id, "ko", target_language)
            print(f"비디오 {video_id} {target_language} 자막 번역 완료")

            # 4. 대상 언어 TTS 생성
            target_audio = await generate_audio_from_transcript(db, video_id, target_language)
            print(f"비디오 {video_id} {target_language} TTS 생성 완료")

        # 처리 완료 상태 업데이트
        update_video_processing_status(db, video_id, True)
        print(f"비디오 {video_id} 모든 처리 완료")

    except Exception as e:
        # 오류 발생 시 상태 업데이트
        error_msg = str(e)
        print(f"비디오 {video_id} 처리 중 오류 발생: {error_msg}")
        update_video_processing_status(db, video_id, False, error_msg)
        raise
