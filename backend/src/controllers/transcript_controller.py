from fastapi import HTTPException, status
from sqlmodel import Session, select
import os
import pathlib
from datetime import datetime

from src.models.transcript import Transcript, TranscriptCreate
from src.models.video import Video
from src.services.transcript import generate_transcript, translate_transcript

# 영상에서 자막 생성
async def create_transcript(db: Session, video_id: int, language: str = "ko"):
    # 영상 존재 확인
    statement = select(Video).where(Video.id == video_id)
    results = await db.execute(statement)
    video = results.scalars().first()

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="영상을 찾을 수 없습니다."
        )

    # 해당 언어로 이미 생성된 자막이 있는지 확인
    transcript_statement = select(Transcript).where(
        Transcript.video_id == video_id,
        Transcript.language == language
    )
    existing_transcript = db.exec(transcript_statement).first()

    if existing_transcript:
        return existing_transcript

    # 자막 생성
    video_path = ""
    if video.url.startswith("static/"):
        # static 폴더 내 영상인 경우
        video_path = video.url
    else:
        # 외부 영상(유튜브 등)인 경우 다운로드 또는 API 사용
        video_path = video.url

    try:
        transcript_data = await generate_transcript(video_path, language)

        # DB에 자막 저장
        db_transcript = Transcript(
            video_id=video_id,
            language=language,
            content=transcript_data["content"],
            timestamps=transcript_data.get("timestamps", None)
        )

        db.add(db_transcript)
        db.commit()
        db.refresh(db_transcript)

        return db_transcript
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"자막 생성 실패: {str(e)}"
        )

# 자막 번역
async def translate_video_transcript(db: Session, transcript_id: int, target_language: str):
    # 자막 존재 확인
    statement = select(Transcript).where(Transcript.id == transcript_id)
    results = await db.execute(statement)
    source_transcript = results.scalars().first()

    if not source_transcript:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="자막을 찾을 수 없습니다."
        )

    # 이미 번역된 자막이 있는지 확인
    translated_statement = select(Transcript).where(
        Transcript.video_id == source_transcript.video_id,
        Transcript.language == target_language
    )
    existing_translation = db.exec(translated_statement).first()

    if existing_translation:
        return existing_translation

    # 자막 번역
    try:
        translated_content = await translate_transcript(
            source_transcript.content,
            source_transcript.language,
            target_language
        )

        # DB에 번역된 자막 저장
        db_translated = Transcript(
            video_id=source_transcript.video_id,
            language=target_language,
            content=translated_content,
            timestamps=source_transcript.timestamps  # 타임스탬프는 원본과 동일하게 유지
        )

        db.add(db_translated)
        db.commit()
        db.refresh(db_translated)

        return db_translated
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"자막 번역 실패: {str(e)}"
        )

# 비디오의 자막 목록 조회
async def get_video_transcripts(db: Session, video_id: int):
    # 데이터베이스에서 자막 조회
    statement = select(Transcript).where(Transcript.video_id == video_id)
    results = db.execute(statement)
    transcripts = results.scalars().all()

    # 파일 시스템에서 자막 파일을 직접 확인 (데이터베이스에 없는 자막도 포함)
    transcripts_dir = pathlib.Path(f"static/transcripts/{video_id}")
    if transcripts_dir.exists() and transcripts_dir.is_dir():
        print(f"트랜스크립트 디렉토리 발견: {transcripts_dir}")

        # 파일 시스템에서 발견된 자막 언어 리스트
        found_languages = []

        # 디렉토리 내 모든 json 파일 확인
        for json_file in transcripts_dir.glob("*.json"):
            print(f"발견된 자막 파일: {json_file}")
            language = json_file.stem  # 파일명에서 확장자 제외한 부분이 언어 코드
            found_languages.append(language)

            # 이미 DB에 있는 언어인지 확인
            db_transcript = next((t for t in transcripts if t.language == language), None)
            if not db_transcript:
                # DB에 없는 자막이라면 파일 내용을 읽어서 임시 객체 생성
                try:
                    with open(json_file, "r", encoding="utf-8") as f:
                        import json
                        transcript_data = json.load(f)

                    # 파일 경로를 저장
                    file_path = str(json_file)

                    # 새 트랜스크립트 객체 생성 (DB에 저장하지 않고 결과만 반환)
                    new_transcript = Transcript(
                        id=-1 * len(transcripts) - 1,  # 임시 음수 ID (충돌 방지)
                        video_id=video_id,
                        language=language,
                        content=transcript_data.get("text", ""),
                        timestamps=json.dumps(transcript_data.get("segments", [])),
                        file_path=file_path,
                        is_processed=True,
                        created_at=datetime.utcnow()
                    )

                    # 결과 리스트에 추가
                    transcripts.append(new_transcript)
                    print(f"파일에서 자막 추가됨: {language}")
                except Exception as e:
                    print(f"자막 파일 읽기 오류: {str(e)}")
            elif not db_transcript.is_processed or not db_transcript.content:
                # DB에 있지만 처리되지 않았거나 내용이 없는 경우 파일에서 내용 업데이트
                try:
                    with open(json_file, "r", encoding="utf-8") as f:
                        import json
                        transcript_data = json.load(f)

                    # DB의 트랜스크립트 업데이트
                    db_transcript.content = transcript_data.get("text", "")
                    db_transcript.timestamps = json.dumps(transcript_data.get("segments", []))
                    db_transcript.file_path = str(json_file)
                    db_transcript.is_processed = True

                    # 변경사항 저장
                    db.add(db_transcript)
                    db.commit()
                    db.refresh(db_transcript)
                    print(f"DB 자막 업데이트됨: {language}")
                except Exception as e:
                    print(f"자막 DB 업데이트 오류: {str(e)}")

    return transcripts
