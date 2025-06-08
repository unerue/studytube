from typing import Dict, Any, List, Optional
import os
import json
import httpx
from pydantic import BaseModel

# OpenAI API 키 (환경변수에서 가져오기)
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "your-openai-api-key")

# API 엔드포인트
OPENAI_API_BASE = "https://api.openai.com/v1"
CHAT_ENDPOINT = f"{OPENAI_API_BASE}/chat/completions"
WHISPER_ENDPOINT = f"{OPENAI_API_BASE}/audio/transcriptions"

# 기본 HTTP 헤더
DEFAULT_HEADERS = {
    "Authorization": f"Bearer {OPENAI_API_KEY}",
    "Content-Type": "application/json"
}

# 테스트 모드 설정
TEST_MODE = False  # 실제 환경에서는 False로 설정

class WhisperResponse(BaseModel):
    text: str
    segments: List[Dict[str, Any]] = []
    language: str


async def transcribe_audio(audio_file_path: str, language: Optional[str] = None) -> WhisperResponse:
    """
    오디오 파일에서 자막을 추출합니다. 테스트 모드에서는 더미 응답을 반환합니다.

    Args:
        audio_file_path: 오디오 파일 경로
        language: 언어 코드 (기본값: None, 자동 감지)

    Returns:
        WhisperResponse: 자막 텍스트, 세그먼트 및 언어 정보
    """
    # 테스트 모드이면 더미 데이터 반환
    if TEST_MODE:
        print(f"테스트 모드: 더미 자막 생성 - {audio_file_path}")

        # 언어 코드 처리
        detected_language = language if language else "ko"
        if detected_language == "ko":
            detected_language = "en"  # 원본은 영어로 가정

        # 언어별 더미 세그먼트 정의
        dummy_segments_by_lang = {
            "en": [
                {
                    "id": 0,
                    "start": 0.0,
                    "end": 10.0,
                    "text": "This is a sample transcript. Welcome to StudyTube."
                },
                {
                    "id": 1,
                    "start": 10.0,
                    "end": 20.0,
                    "text": "With this application, you can learn more effectively from video content."
                },
                {
                    "id": 2,
                    "start": 20.0,
                    "end": 30.0,
                    "text": "The AI features help you understand the content in multiple languages."
                }
            ],
            "ko": [
                {
                    "id": 0,
                    "start": 0.0,
                    "end": 10.0,
                    "text": "이것은 샘플 자막입니다. StudyTube에 오신 것을 환영합니다."
                },
                {
                    "id": 1,
                    "start": 10.0,
                    "end": 20.0,
                    "text": "이 애플리케이션을 통해 영상 콘텐츠에서 더 효과적으로 학습할 수 있습니다."
                },
                {
                    "id": 2,
                    "start": 20.0,
                    "end": 30.0,
                    "text": "AI 기능은 다양한 언어로 내용을 이해하는 데 도움을 줍니다."
                }
            ],
            "ja": [
                {
                    "id": 0,
                    "start": 0.0,
                    "end": 10.0,
                    "text": "これはサンプル字幕です。StudyTubeへようこそ。"
                },
                {
                    "id": 1,
                    "start": 10.0,
                    "end": 20.0,
                    "text": "このアプリケーションを使用すると、ビデオコンテンツからより効果的に学習できます。"
                },
                {
                    "id": 2,
                    "start": 20.0,
                    "end": 30.0,
                    "text": "AI機能は、複数の言語でコンテンツを理解するのに役立ちます。"
                }
            ],
            "fr": [
                {
                    "id": 0,
                    "start": 0.0,
                    "end": 10.0,
                    "text": "Ceci est un exemple de sous-titre. Bienvenue sur StudyTube."
                },
                {
                    "id": 1,
                    "start": 10.0,
                    "end": 20.0,
                    "text": "Avec cette application, vous pouvez apprendre plus efficacement à partir de contenu vidéo."
                },
                {
                    "id": 2,
                    "start": 20.0,
                    "end": 30.0,
                    "text": "Les fonctionnalités d'IA vous aident à comprendre le contenu dans plusieurs langues."
                }
            ]
        }

        # 지원하지 않는 언어는 영어로 대체
        if detected_language not in dummy_segments_by_lang:
            print(f"테스트 모드: 지원하지 않는 언어 '{detected_language}'는 영어로 대체됩니다.")
            detected_language = "en"

        dummy_segments = dummy_segments_by_lang[detected_language]

        # 전체 텍스트 생성
        full_text = " ".join([segment["text"] for segment in dummy_segments])

        return WhisperResponse(
            text=full_text,
            segments=dummy_segments,
            language=detected_language
        )

    try:
        # 실제 OpenAI API 호출 로직
        headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}

        files = {
            "file": open(audio_file_path, "rb"),
            "model": (None, "whisper-1"),
            "response_format": (None, "verbose_json"),
        }

        if language:
            files["language"] = (None, language)

        async with httpx.AsyncClient() as client:
            response = await client.post(
                WHISPER_ENDPOINT,
                headers=headers,
                files=files,
                timeout=120.0
            )

        response.raise_for_status()
        result = response.json()

        return WhisperResponse(
            text=result.get("text", ""),
            segments=result.get("segments", []),
            language=result.get("language", "unknown")
        )
    except Exception as e:
        print(f"자막 추출 중 오류 발생: {str(e)}")
        raise

async def translate_text(text: str, target_language: str) -> str:
    """
    텍스트를 번역합니다. 테스트 모드에서는 더미 번역을 반환합니다.

    Args:
        text: 번역할 텍스트
        target_language: 목표 언어 (예: '한국어', '영어')

    Returns:
        str: 번역된 텍스트
    """
    # 목표 언어를 표준화된 형식으로 변환
    lang_map = {
        "한국어": "ko", "영어": "en", "일본어": "ja", "중국어": "zh-CN",
        "프랑스어": "fr", "독일어": "de", "스페인어": "es", "러시아어": "ru"
    }

    # 언어 코드 표준화
    target_lang_code = target_language
    for name, code in lang_map.items():
        if target_language == name:
            target_lang_code = code
            break

    # 테스트 모드이면 더미 번역 반환
    if TEST_MODE:
        print(f"테스트 모드: 더미 번역 생성 ({target_language})")

        # 원본 텍스트가 비어있으면 샘플 텍스트로 대체
        if not text or len(text.strip()) < 5:
            text = "This is a sample text for translation testing."

        # 언어별 더미 번역 매핑
        dummy_translations = {
            "ko": f"[한국어 번역] {text}",
            "en": f"[English translation] {text}",
            "ja": f"[日本語翻訳] {text}",
            "fr": f"[Traduction française] {text}",
            "de": f"[Deutsche Übersetzung] {text}",
            "es": f"[Traducción española] {text}",
            "ru": f"[Русский перевод] {text}",
            "zh-CN": f"[中文翻译] {text}"
        }

        # 지원하는 언어인지 확인
        if target_lang_code in dummy_translations:
            return dummy_translations[target_lang_code]
        else:
            return f"[Translation to {target_language}] {text}"

    try:
        # 실제 OpenAI API 호출 로직
        data = {
            "model": "gpt-3.5-turbo",
            "messages": [
                {"role": "system", "content": f"당신은 전문 번역가입니다. 다음 텍스트를 {target_language}로 번역해 주세요. 원문의 의미와 뉘앙스를 최대한 유지하면서 자연스럽게 번역하세요."},
                {"role": "user", "content": text}
            ],
            "temperature": 0.3,
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                CHAT_ENDPOINT,
                headers=DEFAULT_HEADERS,
                json=data,
                timeout=60.0
            )

        response.raise_for_status()
        result = response.json()

        translated_text = result.get("choices", [{}])[0].get("message", {}).get("content", "")

        return translated_text if translated_text else text
    except Exception as e:
        print(f"텍스트 번역 중 오류 발생: {str(e)}")
        raise

async def answer_question(context: str, question: str) -> str:
    """
    주어진 컨텍스트를 기반으로 질문에 답변합니다. 테스트 모드에서는 더미 답변을 반환합니다.

    Args:
        context: 질문에 답변하기 위한 컨텍스트 (자막 등)
        question: 사용자 질문

    Returns:
        str: 답변 텍스트
    """
    # 테스트 모드이면 더미 답변 반환
    if TEST_MODE:
        print(f"테스트 모드: 더미 답변 생성 - 질문: '{question}'")

        # 간단한 질문 답변 매핑
        if "내용" in question or "요약" in question:
            return "이 비디오는 학습 관련 내용을 다루고 있으며, 주요 개념과 방법론을 설명합니다."
        elif "시간" in question or "언제" in question:
            return "이 내용은 비디오의 10분 30초 부근에서 설명되고 있습니다."
        elif "학습" in question or "공부" in question:
            return "효과적인 학습을 위해서는 규칙적인 복습과 실습이 중요합니다. 비디오에서는 다양한 학습 기법을 소개하고 있습니다."
        else:
            return f"질문하신 '{question}'에 대한 답변은 비디오에서 찾을 수 있습니다. StudyTube를 통해 더 효과적으로, 영상의 내용을 학습하실 수 있습니다."

    try:
        # 실제 OpenAI API 호출 로직 - 테스트 모드가 아닐 때만 실행
        data = {
            "model": "gpt-4",
            "messages": [
                {
                    "role": "system",
                    "content": "당신은 비디오 콘텐츠 분석 전문가입니다. 비디오의 자막을 기반으로 사용자의 질문에 정확하고 간결하게 답변해 주세요."
                },
                {
                    "role": "user",
                    "content": f"다음은 비디오 자막입니다:\n\n{context}\n\n질문: {question}"
                }
            ],
            "temperature": 0.5,
            "max_tokens": 1000
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                CHAT_ENDPOINT,
                headers=DEFAULT_HEADERS,
                json=data,
                timeout=60.0
            )

        response.raise_for_status()
        result = response.json()

        answer = result.get("choices", [{}])[0].get("message", {}).get("content", "")

        return answer if answer else "죄송합니다. 질문에 답변할 수 없습니다."
    except Exception as e:
        print(f"질문 답변 중 오류 발생: {str(e)}")
        raise
