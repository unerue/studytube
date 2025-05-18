import re
import httpx
from typing import Dict, Any, Optional
import subprocess
from moviepy import VideoFileClip
from PIL import Image

# YouTube 영상 ID 추출 함수
def extract_video_id(url: str) -> Optional[str]:
    """
    YouTube URL에서 영상 ID를 추출합니다.
    
    다양한 YouTube URL 형식 지원:
    - https://www.youtube.com/watch?v=VIDEO_ID
    - https://youtu.be/VIDEO_ID
    - https://www.youtube.com/embed/VIDEO_ID
    """
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    return None

# YouTube API를 통해 영상 정보 가져오기
async def get_video_info(video_id: str, api_key: str) -> Dict[str, Any]:
    """
    YouTube API를 통해 영상 정보를 가져옵니다.
    """
    url = f"https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id={video_id}&key={api_key}"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        data = response.json()
        
        if "items" not in data or len(data["items"]) == 0:
            raise ValueError("영상을 찾을 수 없습니다.")
        
        video_data = data["items"][0]
        snippet = video_data["snippet"]
        
        # 필요한 정보 추출
        result = {
            "title": snippet.get("title", ""),
            "description": snippet.get("description", ""),
            "thumbnail_url": snippet.get("thumbnails", {}).get("high", {}).get("url", ""),
            "published_at": snippet.get("publishedAt", ""),
            "channel_title": snippet.get("channelTitle", ""),
        }
        
        return result

# 자막 가져오기 (간소화된 버전, 실제로는 YouTube API 또는 서드파티 라이브러리 필요)
async def get_video_transcript(video_id: str) -> str:
    """
    영상의 자막을 가져옵니다. (간소화된 버전)
    실제 구현에서는 YouTube API 또는 PyTube, youtube-transcript-api 등을 사용해야 합니다.
    """
    # 이 부분은 실제 구현시 youtube-transcript-api 등을 사용하여 구현
    # 여기서는 더미 데이터 반환
    return "이 영상의 자막입니다. 실제 구현에서는 YouTube API 또는 서드파티 라이브러리를 사용하세요."

def extract_thumbnail_from_video(video_path: str, thumbnail_path: str, time: int = 5) -> None:
    """
    moviepy를 사용해 영상에서 특정 시점(time, 초)의 프레임을 추출해 썸네일 이미지를 저장합니다.
    """
    try:
        with VideoFileClip(video_path) as clip:
            # 영상 길이보다 추출 시간이 길면 마지막 프레임 사용
            t = min(time, int(clip.duration) - 1) if clip.duration > 1 else 0
            frame = clip.get_frame(t)
            image = Image.fromarray(frame)
            image.save(thumbnail_path, "JPEG")
    except Exception as e:
        raise RuntimeError(f"moviepy 썸네일 추출 오류: {e}")