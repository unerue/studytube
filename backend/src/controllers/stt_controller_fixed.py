import os
import tempfile
import asyncio
import io
import wave
import struct
import time
from typing import Any, Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import JSONResponse
import logging
import threading
import queue
import json
from datetime import datetime
import websockets.exceptions

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

router = APIRouter()

# 전역 변수들
client_websocket = None
main_loop = None

# RealtimeSTT 가져오기
REALTIMESTT_AVAILABLE = False
try:
    from RealtimeSTT import AudioToTextRecorder
    REALTIMESTT_AVAILABLE = True
    logger.info("✅ [STT-FIXED] RealtimeSTT 라이브러리 로드 성공")
except ImportError as e:
    logger.warning(f"⚠️ [STT-FIXED] RealtimeSTT 라이브러리가 설치되지 않음: {e}")
    AudioToTextRecorder = None

class FixedLectureRecorder:
    def __init__(self, lecture_id: str, connection_manager):
        self.lecture_id = lecture_id
        self.connection_manager = connection_manager
        self.recorder = None
        self.is_active = False
        self.lock = threading.Lock()
        self.audio_buffer = bytearray()
        self.processor_thread = None
        
        # 통계
        self.stats = {
            "created_at": datetime.now().isoformat(),
            "total_audio_chunks": 0,
            "total_text_results": 0,
            "total_audio_bytes": 0,
            "last_activity": None,
            "error_count": 0
        }
        
        logger.info(f"🎯 [STT-FIXED] FixedLectureRecorder 초기화 - lecture_id: {lecture_id}")
        
        # RealtimeSTT 초기화 (올바른 external feed 패턴)
        if REALTIMESTT_AVAILABLE:
            try:
                logger.info(f"🔧 [STT-FIXED] RealtimeSTT 초기화 시작")
                
                # 외부 오디오 피드를 위한 올바른 설정
                self.recorder = AudioToTextRecorder(
                    use_microphone=False,  # 외부 오디오 사용
                    model="tiny",  # 빠른 모델
                    language="ko",  # 한국어
                    spinner=False,
                    # 외부 피드 모드 최적화 설정
                    silero_sensitivity=0.4,
                    webrtc_sensitivity=2,
                    post_speech_silence_duration=0.7,
                    min_length_of_recording=0,
                    min_gap_between_recordings=0,
                    enable_realtime_transcription=True,
                    realtime_processing_pause=0,
                    realtime_model_type='tiny.en',
                    # 콜백 제거 - external feed 모드에서는 폴링 방식 사용
                )
                
                # 외부 피드 모드에서는 반드시 start() 호출
                self.recorder.start()
                logger.info(f"✅ [STT-FIXED] RealtimeSTT 초기화 및 시작 완료")
                
            except Exception as e:
                logger.error(f"❌ [STT-FIXED] RealtimeSTT 초기화 실패: {e}")
                self.recorder = None
                self.stats["error_count"] += 1
        else:
            logger.warning(f"⚠️ [STT-FIXED] RealtimeSTT 미사용")
            self.recorder = None
    
    def start_processing(self):
        """처리 스레드 시작"""
        if self.processor_thread and self.processor_thread.is_alive():
            logger.warning(f"⚠️ [STT-FIXED] 이미 처리 중 - 강의: {self.lecture_id}")
            return
        
        self.is_active = True
        self.processor_thread = threading.Thread(target=self._process_loop, daemon=True)
        self.processor_thread.start()
        logger.info(f"🚀 [STT-FIXED] 처리 스레드 시작 - 강의: {self.lecture_id}")
    
    def stop_processing(self):
        """처리 중단"""
        self.is_active = False
        if self.processor_thread:
            self.processor_thread.join(timeout=5.0)
        logger.info(f"🛑 [STT-FIXED] 처리 중단 - 강의: {self.lecture_id}")
    
    def _process_loop(self):
        """올바른 external feed 모드 처리 루프"""
        logger.info(f"🔄 [STT-FIXED] 처리 루프 시작 - 강의: {self.lecture_id}")
        
        text_check_count = 0
        valid_text_count = 0
        last_stats_time = time.time()
        last_text_check_time = time.time()
        
        while self.is_active and self.recorder:
            try:
                current_time = time.time()
                
                # 10초마다 상태 리포트
                if current_time - last_stats_time >= 10.0:
                    logger.info(f"📊 [STT-FIXED] 10초 통계 - 강의: {self.lecture_id}")
                    logger.info(f"📊 [STT-FIXED] 텍스트 확인: {text_check_count}, 유효 텍스트: {valid_text_count}")
                    logger.info(f"📊 [STT-FIXED] 총 오디오 청크: {self.stats['total_audio_chunks']}")
                    last_stats_time = current_time
                
                # 1초마다 STT 결과 폴링 (external feed 모드의 올바른 방식)
                if current_time - last_text_check_time >= 1.0:
                    try:
                        text_check_count += 1
                        logger.debug(f"🔍 [STT-FIXED] STT 결과 폴링 #{text_check_count}")
                        
                        # 올바른 방식: external feed 모드에서는 text()를 매개변수 없이 호출
                        text_result = self.recorder.text()
                        
                        if text_result and text_result.strip():
                            valid_text_count += 1
                            self.stats["total_text_results"] += 1
                            
                            logger.info(f"🎯 [STT-FIXED] *** STT 결과 감지! #{valid_text_count} ***")
                            logger.info(f"📝 [STT-FIXED] 텍스트: '{text_result.strip()}'")
                            
                            # 비동기 콜백 처리
                            self._schedule_callback(text_result.strip())
                        
                        last_text_check_time = current_time
                        
                    except Exception as e:
                        logger.debug(f"🔍 [STT-FIXED] STT 폴링 오류 (정상적일 수 있음): {e}")
                
                # 100ms 대기
                time.sleep(0.1)
                
            except Exception as e:
                logger.error(f"❌ [STT-FIXED] 처리 루프 오류: {e}")
                self.stats["error_count"] += 1
                time.sleep(1.0)
        
        logger.info(f"🏁 [STT-FIXED] 처리 루프 종료 - 강의: {self.lecture_id}, 유효 텍스트: {valid_text_count}")
    
    def _schedule_callback(self, text_result: str):
        """비동기 콜백 스케줄링"""
        try:
            def send_result():
                try:
                    new_loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(new_loop)
                    new_loop.run_until_complete(self._text_callback(text_result))
                    new_loop.close()
                except Exception as e:
                    logger.error(f"❌ [STT-FIXED] 콜백 실행 실패: {e}")
            
            threading.Thread(target=send_result, daemon=True).start()
            
        except Exception as e:
            logger.error(f"❌ [STT-FIXED] 콜백 스케줄링 실패: {e}")
    
    async def _text_callback(self, text: str):
        """텍스트 결과 콜백 처리"""
        try:
            subtitle_data = {
                "type": "subtitle",
                "text": text,
                "timestamp": datetime.now().isoformat(),
                "lecture_id": self.lecture_id,
                "realtime": True,
                "fixed_stt": True
            }
            
            await self.connection_manager.broadcast_to_lecture(self.lecture_id, subtitle_data)
            logger.info(f"📢 [STT-FIXED] 자막 브로드캐스트 완료 - '{text[:50]}...'")
            
        except Exception as e:
            logger.error(f"❌ [STT-FIXED] 텍스트 콜백 오류: {e}")
    
    def feed_audio_chunk(self, audio_data: bytes):
        """오디오 데이터 피드"""
        if not self.recorder or not self.is_active:
            return
        
        try:
            self.stats["total_audio_chunks"] += 1
            self.stats["total_audio_bytes"] += len(audio_data)
            self.stats["last_activity"] = datetime.now().isoformat()
            
            # 오디오 데이터를 누적
            self.audio_buffer.extend(audio_data)
            
            # 충분한 데이터가 누적되면 처리
            if len(self.audio_buffer) >= 32000:  # 약 1초 분량
                pcm_data = self._convert_to_pcm(bytes(self.audio_buffer))
                if pcm_data:
                    # RealtimeSTT에 피드
                    self.recorder.feed_audio(pcm_data)
                    logger.info(f"✅ [STT-FIXED] 오디오 피드 완료 - 크기: {len(pcm_data)} bytes")
                
                # 버퍼 초기화
                self.audio_buffer.clear()
            
        except Exception as e:
            logger.error(f"❌ [STT-FIXED] 오디오 피드 오류: {e}")
            self.stats["error_count"] += 1
    
    def _convert_to_pcm(self, audio_data: bytes) -> Optional[bytes]:
        """오디오 데이터를 PCM 형식으로 변환"""
        try:
            # WAV 헤더 확인
            if audio_data.startswith(b'RIFF') and b'WAVE' in audio_data[:20]:
                return self._extract_pcm_from_wav(audio_data)
            else:
                # 이미 PCM 데이터로 가정
                return audio_data
                
        except Exception as e:
            logger.error(f"❌ [STT-FIXED] PCM 변환 오류: {e}")
            return None
    
    def _extract_pcm_from_wav(self, data: bytes) -> bytes:
        """WAV 데이터에서 PCM 추출"""
        try:
            if len(data) < 44:
                return b''
            
            # data 청크 찾기
            data_pos = data.find(b'data')
            if data_pos == -1:
                return b''
            
            # PCM 데이터 추출
            data_size_pos = data_pos + 4
            if data_size_pos + 4 > len(data):
                return b''
            
            data_size = struct.unpack('<I', data[data_size_pos:data_size_pos + 4])[0]
            audio_data_start = data_size_pos + 4
            
            if audio_data_start + data_size > len(data):
                data_size = len(data) - audio_data_start
            
            return data[audio_data_start:audio_data_start + data_size]
            
        except Exception as e:
            logger.error(f"❌ [STT-FIXED] WAV PCM 추출 오류: {e}")
            return b''

# 글로벌 레코더 관리
fixed_recorders: Dict[str, FixedLectureRecorder] = {}

def get_or_create_fixed_recorder(lecture_id: str, connection_manager) -> FixedLectureRecorder:
    """고정 레코더 가져오기/생성"""
    if lecture_id not in fixed_recorders:
        fixed_recorders[lecture_id] = FixedLectureRecorder(lecture_id, connection_manager)
    return fixed_recorders[lecture_id]

# WebSocket 엔드포인트
@router.websocket("/ws/audio-fixed/{lecture_id}")
async def websocket_audio_fixed_endpoint(websocket: WebSocket, lecture_id: str, token: str = Query(None)):
    """고정 STT WebSocket 엔드포인트"""
    global client_websocket, main_loop
    
    await websocket.accept()
    client_websocket = websocket
    main_loop = asyncio.get_event_loop()
    
    logger.info(f"🎤 [STT-FIXED] WebSocket 연결 - lecture_id: {lecture_id}")
    
    # 기존 방식으로 manager import
    from .stt_controller import manager
    
    # 레코더 생성/가져오기
    recorder = get_or_create_fixed_recorder(lecture_id, manager)
    recorder.start_processing()
    
    # 연결 테스트 메시지
    try:
        await manager.broadcast_to_lecture(lecture_id, {
            "type": "subtitle",
            "text": "🧪 고정 STT 시스템이 활성화되었습니다!",
            "timestamp": datetime.now().isoformat(),
            "lecture_id": lecture_id,
            "fixed_stt": True,
            "test": True
        })
        logger.info(f"📢 [STT-FIXED] 테스트 메시지 전송 완료")
    except Exception as e:
        logger.error(f"❌ [STT-FIXED] 테스트 메시지 전송 실패: {e}")
    
    audio_count = 0
    try:
        while True:
            try:
                message = await websocket.receive()
                
                if message["type"] == "websocket.receive":
                    if "bytes" in message:
                        audio_data = message["bytes"]
                        if len(audio_data) > 0:
                            audio_count += 1
                            logger.info(f"📥 [STT-FIXED] 오디오 청크 #{audio_count} - {len(audio_data)} bytes")
                            recorder.feed_audio_chunk(audio_data)
                    
                    elif "text" in message:
                        text_data = message["text"]
                        logger.info(f"📥 [STT-FIXED] 텍스트 메시지: {text_data}")
                        if text_data == "connection-test":
                            await websocket.send_text("connection-test-ok")
                
                elif message["type"] == "websocket.disconnect":
                    logger.info(f"🔌 [STT-FIXED] WebSocket 연결 해제")
                    break
                    
            except WebSocketDisconnect:
                logger.info(f"🔌 [STT-FIXED] WebSocket 연결 끊김")
                break
            except Exception as e:
                logger.error(f"❌ [STT-FIXED] WebSocket 메시지 처리 오류: {e}")
                
    except Exception as e:
        logger.error(f"❌ [STT-FIXED] WebSocket 오류: {e}")
    finally:
        client_websocket = None
        if recorder:
            recorder.stop_processing()
        logger.info(f"🏁 [STT-FIXED] WebSocket 세션 종료 - 총 오디오: {audio_count}")

# 테스트 엔드포인트
@router.post("/test-fixed-subtitle/{lecture_id}")
async def test_fixed_subtitle(lecture_id: str):
    """고정 STT 테스트 자막 엔드포인트"""
    try:
        # 기존 방식으로 manager import
        from .stt_controller import manager
        
        test_messages = [
            "🧪 고정 STT 테스트 메시지 1: 안녕하세요!",
            "🧪 고정 STT 테스트 메시지 2: 음성 인식이 정상 작동합니다.",
            "🧪 고정 STT 테스트 메시지 3: 실시간 자막 시스템 완료!",
            "🧪 고정 STT 테스트 메시지 4: 모든 기능이 정상입니다."
        ]
        
        for i, msg in enumerate(test_messages, 1):
            await manager.broadcast_to_lecture(lecture_id, {
                "type": "subtitle",
                "text": msg,
                "timestamp": datetime.now().isoformat(),
                "lecture_id": lecture_id,
                "fixed_stt": True,
                "test": True,
                "sequence": i
            })
            await asyncio.sleep(0.5)  # 500ms 간격
        
        logger.info(f"✅ [STT-FIXED] 테스트 자막 4개 전송 완료 - lecture_id: {lecture_id}")
        
        return JSONResponse({
            "status": "success",
            "message": "고정 STT 테스트 메시지 4개 전송 완료",
            "lecture_id": lecture_id
        })
        
    except Exception as e:
        logger.error(f"❌ [STT-FIXED] 테스트 자막 전송 실패: {e}")
        return JSONResponse({
            "status": "error",
            "message": f"테스트 자막 전송 실패: {str(e)}",
            "lecture_id": lecture_id
        }, status_code=500) 