from gtts import gTTS
import tempfile
import os
import shutil
from pathlib import Path
from typing import Optional, List, Dict

# 테스트 모드 설정
TEST_MODE = False  # 실제 환경에서는 False로 설정

# 지원 언어 목록
SUPPORTED_LANGUAGES = {
    "ko": "한국어",
    "en": "영어",
    "ja": "일본어",
    "zh-CN": "중국어",
    "es": "스페인어",
    "fr": "프랑스어",
    "de": "독일어",
    "ru": "러시아어"
}

def get_supported_languages() -> Dict[str, str]:
    """
    지원하는 언어 목록을 반환합니다.
    
    Returns:
        Dict[str, str]: 언어 코드와 언어 이름의 매핑
    """
    return SUPPORTED_LANGUAGES

def generate_tts(text: str, language: str, output_path: str) -> bool:
    """
    Google Text-to-Speech(gTTS)를 사용하여 텍스트를 음성으로 변환합니다.
    테스트 모드에서는 더미 오디오 파일을 생성합니다.
    
    Args:
        text: 음성으로 변환할 텍스트
        language: 언어 코드 ('ko', 'en' 등)
        output_path: 출력 파일 경로
        
    Returns:
        bool: 생성 성공 여부
    """
    try:
        # 출력 디렉토리 확인
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # 언어 코드 변환 (ko -> en)
        if language == "ko":
            language = "en"
        
        # 언어 코드가 2자리인지 확인 (일부 언어 제외)
        if language not in ["zh-CN"]:
            lang_code = language[:2]
        else:
            lang_code = language
        
        # 테스트 모드에서는 실제 TTS 생성 시도
        if TEST_MODE:
            print(f"테스트 모드: 실제 TTS 파일 생성 시도 - 언어: {language}, 출력: {output_path}")
            
            # 테스트 텍스트 설정 (짧은 텍스트)
            if not text or len(text) < 5:
                if language == "ko" or lang_code == "ko":
                    text = "안녕하세요. 이것은 테스트 음성입니다."
                else:
                    text = "Hello. This is a test audio message."
            
            try:
                # 실제 TTS 생성 시도
                tts = gTTS(text=text, lang=lang_code, slow=False)
                tts.save(output_path)
                print("실제 TTS 생성 성공!")
                return True
            except Exception as e:
                print(f"TTS 생성 실패, 샘플 파일 찾기 시도: {str(e)}")
                
                # 샘플 오디오 파일 찾기
                sample_paths = [
                    Path("static") / f"sample_{lang_code}.mp3",
                    Path("static") / "sample.mp3",
                    Path("backend/static") / f"sample_{lang_code}.mp3",
                    Path("backend/static") / "sample.mp3"
                ]
                
                for sample_path in sample_paths:
                    if sample_path.exists():
                        print(f"샘플 파일 복사: {sample_path}")
                        shutil.copy(str(sample_path), output_path)
                        return True
                
                # 샘플도 없으면 더미 파일 생성
                print("적절한 샘플 파일을 찾을 수 없어 더미 파일 생성")
                with open(output_path, "wb") as f:
                    # 1KB 더미 MP3 파일 생성
                    mp3_header = b"\xFF\xFB\x90\x44\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"
                    for _ in range(64):
                        f.write(mp3_header)
                return True
        
        # 실제 TTS 생성
        tts = gTTS(text=text, lang=lang_code, slow=False)
        tts.save(output_path)
        
        return True
    except Exception as e:
        print(f"TTS 생성 중 오류 발생: {str(e)}")
        return False

def generate_tts_for_segments(segments: list, language: str, output_path: str) -> bool:
    """
    자막 세그먼트 목록을 받아 음성을 생성합니다.
    
    Args:
        segments: 자막 세그먼트 목록
        language: 언어 코드
        output_path: 출력 파일 경로
        
    Returns:
        bool: 생성 성공 여부
    """
    try:
        # 모든 텍스트 추출
        full_text = " ".join([segment.get("text", "") for segment in segments])
        
        # TTS 생성
        return generate_tts(full_text, language, output_path)
    except Exception as e:
        print(f"세그먼트 TTS 생성 중 오류 발생: {str(e)}")
        return False 