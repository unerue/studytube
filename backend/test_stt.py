import requests
import json
import time
from pathlib import Path

# 백엔드 서버 URL
BASE_URL = "http://localhost:8000"

def test_stt_status():
    """STT 서비스 상태 확인"""
    print("🔍 STT 서비스 상태 확인 중...")
    try:
        response = requests.get(f"{BASE_URL}/api/stt/status")
        if response.status_code == 200:
            data = response.json()
            print("✅ STT 서비스 상태:")
            print(f"   - 레코더 초기화: {data.get('recorder_initialized')}")
            print(f"   - 녹음 중: {data.get('is_recording')}")
            print(f"   - 활성 연결: {data.get('active_connections')}")
            print(f"   - 강의실 수: {data.get('lectures_with_connections')}")
            return True
        else:
            print(f"❌ STT 상태 확인 실패: {response.status_code}")
            return False
    except Exception as e:
        print(f"💥 STT 상태 확인 오류: {e}")
        return False

def test_stt_initialize():
    """STT 서비스 수동 초기화"""
    print("🚀 STT 서비스 초기화 중...")
    try:
        response = requests.post(f"{BASE_URL}/api/stt/initialize")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ STT 초기화 성공: {data.get('message')}")
            return True
        else:
            print(f"❌ STT 초기화 실패: {response.status_code}")
            print(f"   응답: {response.text}")
            return False
    except Exception as e:
        print(f"💥 STT 초기화 오류: {e}")
        return False

def test_stt_transcribe():
    """STT 음성 인식 테스트"""
    print("🎤 STT 음성 인식 테스트 중...")
    
    # 더미 오디오 데이터 생성 (테스트용)
    dummy_audio = b"0" * 5000  # 5KB 더미 데이터
    
    try:
        files = {'file': ('test_audio.webm', dummy_audio, 'audio/webm')}
        data = {'lecture_id': 'test_lecture_123'}
        
        response = requests.post(
            f"{BASE_URL}/api/stt/realtime-transcribe",
            files=files,
            data=data
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ STT 음성 인식 성공:")
            print(f"   - 텍스트: {result.get('text')}")
            print(f"   - 시간: {result.get('timestamp')}")
            print(f"   - 강의 ID: {result.get('lecture_id')}")
            return True
        else:
            print(f"❌ STT 음성 인식 실패: {response.status_code}")
            print(f"   응답: {response.text}")
            return False
    except Exception as e:
        print(f"💥 STT 음성 인식 오류: {e}")
        return False

def test_server_health():
    """서버 전체 상태 확인"""
    print("🏥 서버 전체 상태 확인 중...")
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print("✅ 서버 정상 작동")
            return True
        else:
            print(f"❌ 서버 상태 이상: {response.status_code}")
            return False
    except Exception as e:
        print(f"💥 서버 연결 오류: {e}")
        print("🔧 서버가 실행 중인지 확인해주세요:")
        print("   python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("🧪 STT 서비스 통합 테스트 시작")
    print("=" * 60)
    
    # 1. 서버 상태 확인
    if not test_server_health():
        print("\n❌ 서버가 실행되지 않음. 테스트 중단.")
        exit(1)
    
    print()
    
    # 2. STT 상태 확인
    test_stt_status()
    
    print()
    
    # 3. STT 초기화 테스트
    test_stt_initialize()
    
    print()
    
    # 4. STT 음성 인식 테스트
    test_stt_transcribe()
    
    print()
    print("=" * 60)
    print("🏁 테스트 완료")
    print("=" * 60) 