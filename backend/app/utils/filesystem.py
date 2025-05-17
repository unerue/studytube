import os
import pathlib
from typing import List

# 기본 디렉토리 경로
BASE_DIR = pathlib.Path("static")
VIDEOS_DIR = BASE_DIR / "videos"
TRANSCRIPTS_DIR = BASE_DIR / "transcripts" 
AUDIO_DIR = BASE_DIR / "audio"

def ensure_directories_exist():
    """애플리케이션에 필요한 모든 디렉토리가 존재하는지 확인하고 없으면 생성합니다."""
    directories = [BASE_DIR, VIDEOS_DIR, TRANSCRIPTS_DIR, AUDIO_DIR]
    
    for directory in directories:
        directory.mkdir(exist_ok=True, parents=True)
        print(f"디렉토리 확인: {directory}")

def get_video_transcript_dir(video_id: int) -> pathlib.Path:
    """특정 비디오의 자막 디렉토리 경로를 반환합니다."""
    transcript_dir = TRANSCRIPTS_DIR / str(video_id)
    transcript_dir.mkdir(exist_ok=True, parents=True)
    return transcript_dir

def get_video_audio_dir(video_id: int) -> pathlib.Path:
    """특정 비디오의 오디오 디렉토리 경로를 반환합니다."""
    audio_dir = AUDIO_DIR / str(video_id)
    audio_dir.mkdir(exist_ok=True, parents=True)
    return audio_dir

def get_transcript_path(video_id: int, language: str) -> pathlib.Path:
    """특정 비디오와 언어의 자막 파일 경로를 반환합니다."""
    return get_video_transcript_dir(video_id) / f"{language}.json"

def get_audio_path(video_id: int, language: str) -> pathlib.Path:
    """특정 비디오와 언어의 오디오 파일 경로를 반환합니다."""
    return get_video_audio_dir(video_id) / f"{language}.mp3"

def get_ko_audio_path(video_id: int) -> pathlib.Path:
    """특정 비디오의 원본 오디오 파일 경로를 반환합니다."""
    return get_video_audio_dir(video_id) / "ko.mp3" 