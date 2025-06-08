from fastapi import WebSocket, WebSocketDisconnect, Depends, HTTPException, Query, status
from fastapi.routing import APIRouter
from typing import Dict, List
import json
import logging
import time
import numpy as np
import threading
import asyncio
from scipy.signal import resample
from datetime import datetime
from sqlmodel import Session, select
from ..db.database import get_db
from ..models.user import User
from ..models.lecture import Lecture, LectureParticipant
from ..models.chat import ChatMessage
from ..services.auth import decode_token
from sqlalchemy.ext.asyncio import AsyncSession

# STT 관련 import 추가
from RealtimeSTT import AudioToTextRecorder

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # lecture_id를 키로 하는 연결 관리
        self.active_connections: Dict[int, List[WebSocket]] = {}
        # WebSocket과 사용자 정보 매핑
        self.connection_info: Dict[WebSocket, Dict] = {}
        # 연결 메트릭 추적
        self.connection_metrics = {}

    async def connect(self, websocket: WebSocket, lecture_id: int, user_id: int, username: str):
        start_time = time.time()
        await websocket.accept()
        
        logger.info(f"🟢 [채팅] WebSocket 연결 요청 - lecture_id: {lecture_id}, user_id: {user_id}, username: {username}")
        
        # 동일한 사용자의 기존 연결이 있는지 확인하고 제거
        if lecture_id in self.active_connections:
            existing_connections = []
            for existing_ws in list(self.active_connections[lecture_id]):
                if existing_ws in self.connection_info:
                    existing_info = self.connection_info[existing_ws]
                    if existing_info["user_id"] == user_id:
                        existing_connections.append(existing_ws)
            
            # 기존 연결들 정리
            for existing_ws in existing_connections:
                logger.warning(f"🔄 [채팅] 기존 연결 제거 - user_id: {user_id}, username: {username}")
                self.disconnect(existing_ws)
        
        if lecture_id not in self.active_connections:
            self.active_connections[lecture_id] = []
        
        self.active_connections[lecture_id].append(websocket)
        self.connection_info[websocket] = {
            "lecture_id": lecture_id,
            "user_id": user_id,
            "username": username,
            "connected_at": datetime.now().isoformat(),
            "message_count": 0
        }
        
        # 연결 메트릭 업데이트
        if lecture_id not in self.connection_metrics:
            self.connection_metrics[lecture_id] = {"total_connections": 0, "active_users": set()}
        self.connection_metrics[lecture_id]["total_connections"] += 1
        self.connection_metrics[lecture_id]["active_users"].add(user_id)
        
        connection_time = time.time() - start_time
        logger.info(f"✅ [채팅] WebSocket 연결 완료 - lecture_id: {lecture_id}, user_id: {user_id}, "
                   f"연결 시간: {connection_time:.3f}s, 현재 참가자 수: {len(self.active_connections[lecture_id])}")

    def disconnect(self, websocket: WebSocket):
        connection_info = self.connection_info.get(websocket)
        if connection_info:
            lecture_id = connection_info["lecture_id"]
            user_id = connection_info["user_id"]
            username = connection_info["username"]
            message_count = connection_info.get("message_count", 0)
            connected_at = connection_info.get("connected_at", "unknown")
            
            logger.info(f"🔴 [채팅] WebSocket 연결 해제 - lecture_id: {lecture_id}, user_id: {user_id}, "
                       f"username: {username}, 전송한 메시지 수: {message_count}, 연결 시작: {connected_at}")
            
            if lecture_id in self.active_connections:
                if websocket in self.active_connections[lecture_id]:
                    self.active_connections[lecture_id].remove(websocket)
                if not self.active_connections[lecture_id]:
                    logger.info(f"📝 [채팅] 강의 {lecture_id}의 모든 연결이 종료됨")
                    del self.active_connections[lecture_id]
                else:
                    logger.info(f"📊 [채팅] 강의 {lecture_id} 남은 연결 수: {len(self.active_connections[lecture_id])}")
            
            # 메트릭 업데이트
            if lecture_id in self.connection_metrics:
                self.connection_metrics[lecture_id]["active_users"].discard(user_id)
                if not self.connection_metrics[lecture_id]["active_users"]:
                    logger.info(f"📊 [채팅] 강의 {lecture_id} 메트릭 정리")
                    del self.connection_metrics[lecture_id]
            
            del self.connection_info[websocket]

    async def send_personal_message(self, message: str, websocket: WebSocket):
        try:
            await websocket.send_text(message)
            # 개인 메시지 로깅 (민감한 정보 제외)
            logger.debug(f"📤 [채팅] 개인 메시지 전송 성공 - 길이: {len(message)} chars")
        except Exception as e:
            logger.error(f"❌ [채팅] 개인 메시지 전송 실패 - error: {e}")
            self.disconnect(websocket)

    async def send_to_user(self, message: str, user_id: int, lecture_id: int):
        """특정 사용자에게 메시지 전송"""
        if lecture_id in self.active_connections:
            for websocket in self.active_connections[lecture_id]:
                if websocket in self.connection_info:
                    info = self.connection_info[websocket]
                    if info["user_id"] == user_id and info["lecture_id"] == lecture_id:
                        try:
                            await websocket.send_text(message)
                            logger.info(f"📧 [채팅] 개별 메시지 전송 성공 - user_id: {user_id}, lecture_id: {lecture_id}")
                            return True
                        except Exception as e:
                            logger.error(f"❌ [채팅] 개별 메시지 전송 실패 - user_id: {user_id}, error: {e}")
                            # 연결이 끊어진 경우 정리
                            self.disconnect(websocket)
                            return False
        logger.warning(f"⚠️ [채팅] 사용자를 찾을 수 없음 - user_id: {user_id}, lecture_id: {lecture_id}")
        return False

    async def broadcast_to_lecture(self, message: str, lecture_id: int):
        """특정 강의실의 모든 사용자에게 메시지 브로드캐스트"""
        start_time = time.time()
        if lecture_id not in self.active_connections:
            logger.warning(f"⚠️ [채팅] 브로드캐스트 대상 없음 - lecture_id: {lecture_id}")
            return
        
        connections = self.active_connections[lecture_id].copy()
        success_count = 0
        fail_count = 0
        
        logger.info(f"📢 [채팅] 브로드캐스트 시작 - lecture_id: {lecture_id}, 대상: {len(connections)}명")
        
        for websocket in connections:
            try:
                await websocket.send_text(message)
                success_count += 1
                # 메시지 카운트 업데이트
                if websocket in self.connection_info:
                    self.connection_info[websocket]["message_count"] += 1
            except Exception as e:
                fail_count += 1
                logger.error(f"❌ [채팅] 브로드캐스트 개별 전송 실패 - error: {e}")
                # 연결이 끊어진 경우 정리
                self.disconnect(websocket)
        
        broadcast_time = time.time() - start_time
        logger.info(f"✅ [채팅] 브로드캐스트 완료 - lecture_id: {lecture_id}, "
                   f"성공: {success_count}, 실패: {fail_count}, 소요시간: {broadcast_time:.3f}s")

    def get_participants(self, lecture_id: int) -> List[Dict]:
        """특정 강의의 참가자 목록 반환"""
        participants = []
        if lecture_id in self.active_connections:
            for websocket in self.active_connections[lecture_id]:
                if websocket in self.connection_info:
                    info = self.connection_info[websocket]
                    participants.append({
                        "user_id": info["user_id"],
                        "username": info["username"],
                        "connected_at": info.get("connected_at", ""),
                        "message_count": info.get("message_count", 0)
                    })
        
        logger.debug(f"👥 [채팅] 참가자 목록 조회 - lecture_id: {lecture_id}, 참가자 수: {len(participants)}")
        return participants

    def get_connection_stats(self) -> Dict:
        """연결 통계 반환"""
        total_connections = sum(len(conns) for conns in self.active_connections.values())
        active_lectures = len(self.active_connections)
        
        stats = {
            "total_connections": total_connections,
            "active_lectures": active_lectures,
            "lecture_details": {}
        }
        
        for lecture_id, connections in self.active_connections.items():
            stats["lecture_details"][lecture_id] = {
                "connections": len(connections),
                "unique_users": len(set(
                    info["user_id"] for info in self.connection_info.values()
                    if info["lecture_id"] == lecture_id
                ))
            }
        
        return stats

manager = ConnectionManager()

class STTConnectionManager:
    def __init__(self):
        # lecture_id를 키로 하는 STT 연결 관리
        self.active_connections: Dict[int, List[WebSocket]] = {}
        # WebSocket과 사용자 정보 매핑
        self.connection_info: Dict[WebSocket, Dict] = {}
        # 각 강의별 STT 레코더
        self.stt_recorders: Dict[int, AudioToTextRecorder] = {}
        # 레코더 준비 상태
        self.recorder_ready: Dict[int, threading.Event] = {}
        # 메인 이벤트 루프
        self.main_loop = None

    async def connect(self, websocket: WebSocket, lecture_id: int, user_id: int, username: str):
        await websocket.accept()
        logger.info(f"🎙️ [STT] WebSocket 연결 요청 - lecture_id: {lecture_id}, user_id: {user_id}, username: {username}")
        
        if lecture_id not in self.active_connections:
            self.active_connections[lecture_id] = []
            # 새로운 강의에 대해 STT 레코더 초기화
            await self.initialize_stt_recorder(lecture_id)
        
        self.active_connections[lecture_id].append(websocket)
        self.connection_info[websocket] = {
            "lecture_id": lecture_id,
            "user_id": user_id,
            "username": username,
            "connected_at": datetime.now().isoformat()
        }
        
        logger.info(f"✅ [STT] WebSocket 연결 완료 - lecture_id: {lecture_id}, user_id: {user_id}")

    async def connect_without_accept(self, websocket: WebSocket, lecture_id: int, user_id: int, username: str):
        """WebSocket.accept() 호출 없이 연결 관리 (이미 accept된 연결에 사용)"""
        logger.info(f"🎙️ [STT] WebSocket 연결 관리 - lecture_id: {lecture_id}, user_id: {user_id}, username: {username}")
        
        if lecture_id not in self.active_connections:
            self.active_connections[lecture_id] = []
            # 새로운 강의에 대해 STT 레코더 초기화
            await self.initialize_stt_recorder(lecture_id)
        
        self.active_connections[lecture_id].append(websocket)
        self.connection_info[websocket] = {
            "lecture_id": lecture_id,
            "user_id": user_id,
            "username": username,
            "connected_at": datetime.now().isoformat()
        }
        
        logger.info(f"✅ [STT] WebSocket 연결 추적 완료 - lecture_id: {lecture_id}, user_id: {user_id}")

    def disconnect(self, websocket: WebSocket):
        connection_info = self.connection_info.get(websocket)
        if connection_info:
            lecture_id = connection_info["lecture_id"]
            user_id = connection_info["user_id"]
            username = connection_info["username"]
            
            logger.info(f"🔴 [STT] WebSocket 연결 해제 - lecture_id: {lecture_id}, user_id: {user_id}, username: {username}")
            
            if lecture_id in self.active_connections:
                if websocket in self.active_connections[lecture_id]:
                    self.active_connections[lecture_id].remove(websocket)
                
                # 강의에 연결된 모든 사용자가 없으면 STT 레코더 정리
                if not self.active_connections[lecture_id]:
                    logger.info(f"📝 [STT] 강의 {lecture_id}의 모든 연결이 종료됨 - STT 레코더 정리")
                    self.cleanup_stt_recorder(lecture_id)
                    del self.active_connections[lecture_id]
            
            del self.connection_info[websocket]

    async def initialize_stt_recorder(self, lecture_id: int):
        """강의별 STT 레코더 초기화"""
        try:
            logger.info(f"🔧 [STT] 강의 {lecture_id} STT 레코더 초기화 시작")
            
            # 레코더 설정
            recorder_config = {
                'spinner': False,
                'use_microphone': False,  # 마이크 사용 안함, feed_audio로 오디오 제공
                'model': 'large-v2',
                'language': 'ko',  # 한국어 설정
                'silero_sensitivity': 0.4,
                'webrtc_sensitivity': 2,
                'post_speech_silence_duration': 0.7,
                'min_length_of_recording': 0,
                'min_gap_between_recordings': 0,
                'enable_realtime_transcription': True,
                'realtime_processing_pause': 0,
                'realtime_model_type': 'tiny',
                'on_realtime_transcription_stabilized': lambda text: self.on_realtime_text(lecture_id, text),
            }
            
            # 레코더 준비 이벤트 생성 (먼저 생성하여 스레드에서 안전하게 접근할 수 있게 함)
            event = threading.Event()
            self.recorder_ready[lecture_id] = event
            self.main_loop = asyncio.get_running_loop()
            
            def initialize_recorder():
                try:
                    logger.info(f"🔄 [STT] 강의 {lecture_id} STT 레코더 백그라운드 초기화 시작")
                    self.stt_recorders[lecture_id] = AudioToTextRecorder(**recorder_config)
                    
                    # 스레드 안전하게 이벤트 설정
                    try:
                        if lecture_id in self.recorder_ready:
                            self.recorder_ready[lecture_id].set()
                            logger.info(f"✅ [STT] 강의 {lecture_id} STT 레코더 초기화 완료")
                        else:
                            logger.warning(f"⚠️ [STT] 강의 {lecture_id} 레코더 이벤트가 존재하지 않음")
                    except Exception as set_err:
                        logger.error(f"❌ [STT] 강의 {lecture_id} 레코더 이벤트 설정 오류: {set_err}")
                    
                    # 완성된 문장 감지 루프
                    while lecture_id in self.stt_recorders:
                        try:
                            full_sentence = self.stt_recorders[lecture_id].text()
                            if full_sentence:
                                asyncio.run_coroutine_threadsafe(
                                    self.on_full_sentence(lecture_id, full_sentence),
                                    self.main_loop
                                )
                        except Exception as e:
                            logger.error(f"❌ [STT] 강의 {lecture_id} 완성된 문장 감지 오류: {e}")
                            break
                            
                except Exception as e:
                    logger.error(f"❌ [STT] 강의 {lecture_id} STT 레코더 초기화 실패: {e}")
                    # 스레드 안전하게 이벤트 설정 (실패해도)
                    try:
                        if lecture_id in self.recorder_ready:
                            self.recorder_ready[lecture_id].set()
                        else:
                            logger.warning(f"⚠️ [STT] 강의 {lecture_id} 레코더 이벤트가 존재하지 않음 (오류 처리 중)")
                    except Exception as set_err:
                        logger.error(f"❌ [STT] 강의 {lecture_id} 레코더 이벤트 설정 오류 (오류 처리 중): {set_err}")
            
            # 백그라운드 스레드 시작
            thread = threading.Thread(target=initialize_recorder, daemon=True)
            thread.start()
            logger.info(f"🧵 [STT] 강의 {lecture_id} STT 레코더 초기화 스레드 시작됨")
            
        except Exception as e:
            logger.error(f"❌ [STT] 강의 {lecture_id} STT 레코더 초기화 중 오류: {e}")
            # 메인 스레드에서 오류 발생 시 이벤트 정리
            if lecture_id in self.recorder_ready:
                del self.recorder_ready[lecture_id]

    def cleanup_stt_recorder(self, lecture_id: int):
        """강의별 STT 레코더 정리"""
        try:
            if lecture_id in self.stt_recorders:
                self.stt_recorders[lecture_id].stop()
                self.stt_recorders[lecture_id].shutdown()
                del self.stt_recorders[lecture_id]
                logger.info(f"🧹 [STT] 강의 {lecture_id} STT 레코더 정리 완료")
            
            if lecture_id in self.recorder_ready:
                del self.recorder_ready[lecture_id]
                
        except Exception as e:
            logger.error(f"❌ [STT] 강의 {lecture_id} STT 레코더 정리 중 오류: {e}")

    def on_realtime_text(self, lecture_id: int, text: str):
        """실시간 텍스트 콜백"""
        if self.main_loop:
            asyncio.run_coroutine_threadsafe(
                self.broadcast_to_lecture(json.dumps({
                    'type': 'realtime',
                    'text': text
                }), lecture_id),
                self.main_loop
            )

    async def on_full_sentence(self, lecture_id: int, text: str):
        """완성된 문장 콜백"""
        await self.broadcast_to_lecture(json.dumps({
            'type': 'fullSentence',
            'text': text
        }), lecture_id)
        logger.info(f"📝 [STT] 강의 {lecture_id} 완성된 문장: {text}")

    async def process_audio(self, lecture_id: int, audio_data: bytes, sample_rate: int):
        """오디오 데이터 처리"""
        try:
            # 레코더 이벤트 존재 여부 확인
            if lecture_id not in self.recorder_ready:
                logger.warning(f"⚠️ [STT] 강의 {lecture_id} 레코더가 준비되지 않음 (이벤트 없음)")
                return
            
            # 레코더 이벤트 객체 안전하게 가져오기
            try:
                event = self.recorder_ready[lecture_id]
            except KeyError:
                logger.warning(f"⚠️ [STT] 강의 {lecture_id} 레코더 이벤트에 접근할 수 없음")
                return
                
            # 레코더가 준비될 때까지 대기 (최대 1초)
            if not event.wait(timeout=1.0):
                logger.warning(f"⚠️ [STT] 강의 {lecture_id} 레코더 준비 타임아웃")
                return
            
            # 레코더 객체 존재 여부 확인
            if lecture_id not in self.stt_recorders:
                logger.warning(f"⚠️ [STT] 강의 {lecture_id} STT 레코더를 찾을 수 없음")
                return
            
            try:
                # 오디오 리샘플링 (16kHz로)
                resampled_audio = self.decode_and_resample(audio_data, sample_rate, 16000)
                
                # STT 레코더에 오디오 데이터 제공
                self.stt_recorders[lecture_id].feed_audio(resampled_audio)
            except Exception as audio_err:
                logger.error(f"❌ [STT] 강의 {lecture_id} 오디오 처리 중 오류: {audio_err}")
            
        except Exception as e:
            logger.error(f"❌ [STT] 강의 {lecture_id} 오디오 처리 중 일반 오류: {e}")

    def decode_and_resample(self, audio_data: bytes, original_sample_rate: int, target_sample_rate: int) -> bytes:
        """오디오 데이터 디코딩 및 리샘플링"""
        try:
            audio_np = np.frombuffer(audio_data, dtype=np.int16)
            num_original_samples = len(audio_np)
            num_target_samples = int(num_original_samples * target_sample_rate / original_sample_rate)
            resampled_audio = resample(audio_np, num_target_samples)
            return resampled_audio.astype(np.int16).tobytes()
        except Exception as e:
            logger.error(f"❌ [STT] 오디오 리샘플링 오류: {e}")
            return audio_data

    async def broadcast_to_lecture(self, message: str, lecture_id: int):
        """특정 강의실의 모든 사용자에게 메시지 브로드캐스트"""
        if lecture_id not in self.active_connections:
            return
        
        connections = self.active_connections[lecture_id].copy()
        success_count = 0
        fail_count = 0
        
        for websocket in connections:
            try:
                await websocket.send_text(message)
                success_count += 1
            except Exception as e:
                fail_count += 1
                logger.error(f"❌ [STT] 브로드캐스트 개별 전송 실패: {e}")
                self.disconnect(websocket)
        
        logger.debug(f"📢 [STT] 브로드캐스트 완료 - lecture_id: {lecture_id}, 성공: {success_count}, 실패: {fail_count}")

# STT 전용 ConnectionManager 인스턴스
stt_manager = STTConnectionManager()

@router.websocket("/ws/chat/{lecture_id}")
async def websocket_endpoint(websocket: WebSocket, lecture_id: int, token: str = Query(None)):
    # 쿼리 파라미터에서 토큰 가져오기 (수동으로)
    query_string = str(websocket.url.query)
    logger.info(f"🚀 [채팅] WebSocket 연결 시도 - lecture_id: {lecture_id}")
    logger.debug(f"🔍 [채팅] 전체 URL: {websocket.url}")
    logger.debug(f"🔍 [채팅] 쿼리 스트링: {query_string}")
    logger.debug(f"🔍 [채팅] FastAPI 파라미터 token: {'exists' if token else 'missing'}")
    
    # 수동으로 토큰 파싱 시도
    if not token and 'token=' in query_string:
        import urllib.parse
        parsed_query = urllib.parse.parse_qs(query_string)
        if 'token' in parsed_query:
            token = parsed_query['token'][0]
            logger.info(f"🔑 [채팅] 수동 파싱으로 토큰 발견: {token[:20]}...")
    
    if not token:
        logger.warning("⚠️ [채팅] 토큰이 없음 - 테스트를 위해 임시로 연결 허용")
        # 임시 테스트 사용자 정보
        user_id = 999
        username = "test_user"
    else:
        # 정상 토큰 검증 진행
        logger.info(f"🔐 [채팅] 토큰 검증 시도: {token[:20]}...")
        payload = decode_token(token)
        
        if payload is None:
            logger.error("❌ [채팅] 토큰 검증 실패 - payload가 None")
            await websocket.close(code=1008, reason="토큰 검증 실패")
            return
            
        logger.info(f"✅ [채팅] 토큰 검증 성공: {payload}")
        
        user_id = payload.get("user_id")
        username = payload.get("sub")  # JWT의 sub 필드에 username이 저장됨
        
        logger.info(f"👤 [채팅] 사용자 정보 - user_id: {user_id}, username: {username}")
        
        if not user_id or not username:
            logger.error("❌ [채팅] 사용자 정보 부족 - 연결 거부")
            await websocket.close(code=1008, reason="유효하지 않은 토큰입니다")
            return
    
    try:
        
        # 사용자 정보 확인 (역할 포함) - 토큰이 있는 경우만
        if token and user_id != 999:
            from sqlmodel import select
            from ..db.database import get_db
            
            # 실제 사용자 조회
            async for db in get_db():
                statement = select(User).where(User.id == user_id)
                result = await db.exec(statement)
                user = result.first()
                if user:
                    logger.info(f"✅ [채팅] WebSocket 연결 성공 - user_id: {user_id}, username: {username}, role: {user.role}, lecture_id: {lecture_id}")
                else:
                    logger.warning(f"⚠️ [채팅] WebSocket 연결 성공 - user_id: {user_id}, username: {username}, role: 알 수 없음, lecture_id: {lecture_id}")
                break
        else:
            logger.info(f"🧪 [채팅] WebSocket 연결 성공 (테스트 모드) - user_id: {user_id}, username: {username}, lecture_id: {lecture_id}")
        
        await manager.connect(websocket, lecture_id, user_id, username)
        
        # 입장 메시지 브로드캐스트
        join_message = {
            "type": "user_joined",
            "username": username,
            "message": f"{username}님이 참여했습니다.",
            "timestamp": datetime.now().isoformat()
        }
        logger.info(f"📢 [채팅] 입장 메시지 브로드캐스트: username={username}, lecture_id={lecture_id}")
        await manager.broadcast_to_lecture(json.dumps(join_message), lecture_id)
        
        # 참가자 목록 브로드캐스트
        participants = manager.get_participants(lecture_id)
        participants_message = {
            "type": "participants_update",
            "participants": participants,
            "currentUserId": user_id,  # 현재 사용자 ID 추가
            "timestamp": datetime.now().isoformat()
        }
        logger.info(f"👥 [채팅] 참가자 목록 브로드캐스트 - lecture_id: {lecture_id}, 참가자 수: {len(participants)}")
        await manager.broadcast_to_lecture(json.dumps(participants_message), lecture_id)
        
        while True:
            # 클라이언트로부터 메시지 수신
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            message_type = message_data.get("type", "unknown")
            logger.info(f"📥 [채팅] 메시지 수신 - user_id: {user_id}, type: {message_type}, lecture_id: {lecture_id}")
            
            # 메시지 타입 처리
            if message_data.get("type") == "chat_message":
                chat_content = message_data.get("message", "")
                is_private = message_data.get("is_private", False)
                
                logger.info(f"💬 [채팅] 채팅 메시지 처리 - user_id: {user_id}, username: {username}, "
                           f"private: {is_private}, 길이: {len(chat_content)} chars")
                
                chat_message = {
                    "type": "chat_message",
                    "user_id": user_id,
                    "username": username,
                    "message": chat_content,
                    "is_private": is_private,
                    "timestamp": datetime.now().isoformat()
                }
                
                # 모든 강의 참가자에게 브로드캐스트
                await manager.broadcast_to_lecture(json.dumps(chat_message), lecture_id)
                
            elif message_data.get("type") == "subtitle":
                # STT 자막 메시지 처리
                subtitle_text = message_data.get("text", "")
                confidence = message_data.get("confidence", 0.9)
                
                logger.info(f"📝 [채팅] STT 자막 메시지 처리 - user_id: {user_id}, username: {username}, "
                           f"텍스트 길이: {len(subtitle_text)} chars, confidence: {confidence}")
                
                subtitle_message = {
                    "type": "subtitle",
                    "user_id": user_id,
                    "username": username,
                    "text": subtitle_text,
                    "translatedText": message_data.get("translatedText", ""),
                    "language": message_data.get("language", "ko"),
                    "translationLanguage": message_data.get("translationLanguage", "en"),
                    "confidence": confidence,
                    "timestamp": datetime.now().isoformat()
                }
                
                logger.info(f"📢 [채팅] STT 자막 메시지 브로드캐스트 - 텍스트: '{subtitle_text[:50]}{'...' if len(subtitle_text) > 50 else ''}'")
                # 모든 강의 참가자에게 브로드캐스트
                await manager.broadcast_to_lecture(json.dumps(subtitle_message), lecture_id)
                
            elif message_data.get("type") == "screen_share":
                # 화면 공유 상태 변경 (기존 방식 유지)
                is_sharing = message_data.get("is_sharing", False)
                logger.info(f"🖥️ [채팅] 화면공유 상태 변경 - username: {username}, is_sharing: {is_sharing}")
                
                screen_share_message = {
                    "type": "screen_share",
                    "user_id": user_id,
                    "username": username,
                    "is_sharing": is_sharing,
                    "timestamp": datetime.now().isoformat()
                }
                logger.info(f"📢 [채팅] 화면공유 메시지 브로드캐스트: {screen_share_message}")
                await manager.broadcast_to_lecture(json.dumps(screen_share_message), lecture_id)
                
            # WebRTC Signaling 메시지 처리
            elif message_data.get("type") == "screen_share_started":
                # 강사가 화면 공유를 시작했을 때
                logger.info(f"🎬 [채팅] 화면 공유 시작 - instructor: {username} (ID: {user_id})")
                signaling_message = {
                    "type": "screen_share_started",
                    "instructorId": user_id,
                    "username": username,
                    "lectureId": lecture_id,
                    "timestamp": datetime.now().isoformat()
                }
                await manager.broadcast_to_lecture(json.dumps(signaling_message), lecture_id)
                
            elif message_data.get("type") == "screen_share_stopped":
                # 강사가 화면 공유를 중지했을 때
                logger.info(f"🛑 [채팅] 화면 공유 중지 - instructor: {username} (ID: {user_id})")
                signaling_message = {
                    "type": "screen_share_stopped",
                    "instructorId": user_id,
                    "username": username,
                    "lectureId": lecture_id,
                    "timestamp": datetime.now().isoformat()
                }
                await manager.broadcast_to_lecture(json.dumps(signaling_message), lecture_id)
                
            elif message_data.get("type") == "request_connection":
                # 학생이 강사에게 연결을 요청할 때
                target_instructor_id = message_data.get("targetInstructorId")
                logger.info(f"🤝 [채팅] 연결 요청 - from: {username} (ID: {user_id}), to: instructor (ID: {target_instructor_id})")
                
                connection_request = {
                    "type": "request_connection",
                    "fromStudentId": user_id,
                    "username": username,
                    "lectureId": lecture_id,
                    "timestamp": datetime.now().isoformat()
                }
                if target_instructor_id:
                    await manager.send_to_user(json.dumps(connection_request), target_instructor_id, lecture_id)
                
            elif message_data.get("type") == "offer":
                # WebRTC Offer 전달
                target_peer_id = message_data.get("targetPeerId")
                logger.info(f"📞 [채팅] WebRTC Offer 전달 - from: {user_id}, to: {target_peer_id}")
                
                offer_message = {
                    "type": "offer",
                    "offer": message_data.get("offer"),
                    "fromPeerId": user_id,
                    "targetPeerId": target_peer_id,
                    "lectureId": lecture_id,
                    "timestamp": datetime.now().isoformat()
                }
                # 특정 대상에게만 전달
                if target_peer_id:
                    await manager.send_to_user(json.dumps(offer_message), target_peer_id, lecture_id)
                    
            elif message_data.get("type") == "answer":
                # WebRTC Answer 전달
                target_peer_id = message_data.get("targetPeerId")
                logger.info(f"📞 [채팅] WebRTC Answer 전달 - from: {user_id}, to: {target_peer_id}")
                
                answer_message = {
                    "type": "answer",
                    "answer": message_data.get("answer"),
                    "fromPeerId": user_id,
                    "targetPeerId": target_peer_id,
                    "lectureId": lecture_id,
                    "timestamp": datetime.now().isoformat()
                }
                # 특정 대상에게만 전달
                if target_peer_id:
                    await manager.send_to_user(json.dumps(answer_message), target_peer_id, lecture_id)
                    
            elif message_data.get("type") == "ice-candidate":
                # ICE Candidate 전달
                target_peer_id = message_data.get("targetPeerId")
                logger.debug(f"🧊 [채팅] ICE Candidate 전달 - from: {user_id}, to: {target_peer_id}")
                
                candidate_message = {
                    "type": "ice-candidate",
                    "candidate": message_data.get("candidate"),
                    "fromPeerId": user_id,
                    "targetPeerId": target_peer_id,
                    "lectureId": lecture_id,
                    "timestamp": datetime.now().isoformat()
                }
                # 특정 대상에게만 전달
                if target_peer_id:
                    await manager.send_to_user(json.dumps(candidate_message), target_peer_id, lecture_id)
            
            else:
                logger.warning(f"⚠️ [채팅] 알 수 없는 메시지 타입 - type: {message_type}, user_id: {user_id}")
    
    except WebSocketDisconnect:
        logger.info(f"🔌 [채팅] WebSocket 정상 연결 해제 - user_id: {user_id}, lecture_id: {lecture_id}")
        manager.disconnect(websocket)
        # 퇴장 메시지 브로드캐스트
        if websocket in manager.connection_info:
            info = manager.connection_info[websocket]
            leave_message = {
                "type": "user_left",
                "username": info["username"],
                "message": f"{info['username']}님이 나갔습니다.",
                "timestamp": datetime.now().isoformat()
            }
            logger.info(f"📢 [채팅] 퇴장 메시지 브로드캐스트 - username: {info['username']}")
            await manager.broadcast_to_lecture(json.dumps(leave_message), lecture_id)
            
            # 업데이트된 참여자 목록 브로드캐스트
            participants = manager.get_participants(lecture_id)
            participants_update = {
                "type": "participants_update",
                "participants": participants,
                "timestamp": datetime.now().isoformat()
            }
            logger.info(f"👥 [채팅] 참가자 목록 업데이트 브로드캐스트 - 남은 참가자: {len(participants)}명")
            await manager.broadcast_to_lecture(json.dumps(participants_update), lecture_id)
    except Exception as e:
        logger.error(f"💥 [채팅] WebSocket 예외 오류 - error: {e}, type: {type(e)}")
        import traceback
        logger.error(f"📜 [채팅] 전체 스택 트레이스: {traceback.format_exc()}")
        try:
            await websocket.close(code=1011, reason="서버 오류")
            logger.info(f"🔒 [채팅] WebSocket 강제 닫기 완료 - user_id: {user_id}")
        except:
            logger.error(f"❌ [채팅] WebSocket 강제 닫기 실패 - user_id: {user_id}")
    finally:
        # 연결 통계 로깅
        stats = manager.get_connection_stats()
        logger.info(f"📊 [채팅] 현재 연결 통계 - 총 연결: {stats['total_connections']}, 활성 강의: {stats['active_lectures']}")

# 연결 상태 조회 엔드포인트 (디버깅용)
@router.get("/ws/chat/stats")
async def get_chat_stats():
    """채팅 WebSocket 연결 통계 조회"""
    stats = manager.get_connection_stats()
    logger.info(f"📈 [채팅] 통계 조회 요청 - {stats}")
    return stats

@router.get("/ws/chat/debug")
async def get_chat_debug_info():
    """채팅 시스템 디버그 정보 조회"""
    debug_info = {
        "connection_stats": manager.get_connection_stats(),
        "active_lectures": list(manager.active_connections.keys()),
        "connection_details": {
            lecture_id: len(connections) 
            for lecture_id, connections in manager.active_connections.items()
        },
        "total_connection_info_entries": len(manager.connection_info)
    }
    
    logger.info(f"🔧 [채팅] 디버그 정보 조회 - {debug_info}")
    return debug_info

@router.get("/api/chat/{lecture_id}/history")
async def get_chat_history(
    lecture_id: int,
    session: AsyncSession = Depends(get_db),
    limit: int = 50
):
    """강의 채팅 기록 조회"""
    statement = (
        select(ChatMessage, User.username)
        .join(User)
        .where(ChatMessage.lecture_id == lecture_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    )
    
    results = await session.execute(statement)
    
    messages = []
    for chat_message, username in results:
        messages.append({
            "id": chat_message.id,
            "user_id": chat_message.user_id,
            "username": username,
            "message": chat_message.message,
            "is_private": chat_message.is_private,
            "created_at": chat_message.created_at.isoformat()
        })
    
    return {"messages": list(reversed(messages))}

@router.get("/api/lectures/{lecture_id}/participants")
async def get_lecture_participants(lecture_id: int):
    """특정 강의의 현재 참가자 목록 반환"""
    participants = manager.get_participants(lecture_id)
    return {"participants": participants}

@router.websocket("/ws/stt/{lecture_id}")
async def stt_websocket_endpoint(websocket: WebSocket, lecture_id: int, token: str = Query(None)):
    """STT WebSocket 엔드포인트"""
    # 웹소켓 연결 수락
    await websocket.accept()
    logger.info(f"🔌 [STT] 새 WebSocket 연결 수락 - lecture_id: {lecture_id}")
    
    # 클라이언트로부터 인증 메시지 대기
    try:
        # 인증 메시지 대기 (최대 10초)
        for _ in range(10):
            try:
                # 5초 타임아웃으로 메시지 대기
                message = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
                
                try:
                    data = json.loads(message)
                    if data.get("type") == "auth" and data.get("token"):
                        token = data["token"]
                        logger.info(f"🔐 [STT] 인증 메시지 수신 - lecture_id: {lecture_id}")
                        break
                    else:
                        logger.warning(f"⚠️ [STT] 잘못된 인증 메시지 형식 - lecture_id: {lecture_id}")
                except json.JSONDecodeError:
                    logger.warning(f"⚠️ [STT] 인증 메시지 JSON 파싱 실패 - lecture_id: {lecture_id}")
                    continue
                    
            except asyncio.TimeoutError:
                logger.warning(f"⚠️ [STT] 인증 메시지 대기 타임아웃 - lecture_id: {lecture_id}")
                continue
                
        else:  # for-else: for 루프가 break 없이 완료되면 실행
            logger.error(f"❌ [STT] 인증 시간 초과 - lecture_id: {lecture_id}")
            await websocket.send_text(json.dumps({
                "type": "auth_response",
                "status": "error",
                "message": "인증 시간이 초과되었습니다."
            }))
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        # 토큰이 없는 경우
        if not token:
            logger.error(f"❌ [STT] 토큰 없음 - lecture_id: {lecture_id}")
            await websocket.send_text(json.dumps({
                "type": "auth_response",
                "status": "error",
                "message": "인증 토큰이 없습니다."
            }))
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        try:
            # 토큰에서 사용자 정보 추출
            payload = decode_token(token)
            user_id = payload.get("user_id")
            
            if not user_id:
                logger.error(f"❌ [STT] 토큰에 user_id 없음 - lecture_id: {lecture_id}")
                await websocket.send_text(json.dumps({
                    "type": "auth_response",
                    "status": "error",
                    "message": "유효하지 않은 토큰입니다."
                }))
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
            
            # 동기 세션으로 사용자 정보 조회
            from sqlmodel import Session, create_engine
            from ..db.database import DATABASE_URL
            
            sync_db_url = DATABASE_URL.replace("sqlite+aiosqlite://", "sqlite://")
            sync_engine = create_engine(sync_db_url)
            
            with Session(sync_engine) as session:
                user = session.get(User, user_id)
                if not user:
                    logger.error(f"❌ [STT] 사용자 없음 - user_id: {user_id}, lecture_id: {lecture_id}")
                    await websocket.send_text(json.dumps({
                        "type": "auth_response",
                        "status": "error",
                        "message": "사용자를 찾을 수 없습니다."
                    }))
                    await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                    return
                
                username = user.username
            
            # 인증 성공 응답
            await websocket.send_text(json.dumps({
                "type": "auth_response",
                "status": "success",
                "message": "인증에 성공했습니다."
            }))
            logger.info(f"✅ [STT] 인증 성공 - user_id: {user_id}, username: {username}, lecture_id: {lecture_id}")
            
            # STT 연결 관리자에 연결
            await stt_manager.connect_without_accept(websocket, lecture_id, user_id, username)
            
            try:
                # WebSocket에서 메시지 받기 
                while True:
                    try:
                        # 메시지 수신 대기
                        message = await websocket.receive()
                        
                        # 바이너리 메시지 처리 (오디오 데이터)
                        if "bytes" in message:
                            data = message.get("bytes")
                            # 메타데이터 길이 읽기 (첫 4바이트)
                            if len(data) < 4:
                                logger.warning("⚠️ [STT] 메시지가 너무 짧음")
                                continue
                            
                            metadata_length = int.from_bytes(data[:4], byteorder='little')
                            
                            # 메타데이터가 메시지 길이를 초과하는지 확인
                            if 4 + metadata_length > len(data):
                                logger.warning("⚠️ [STT] 잘못된 메타데이터 길이")
                                continue
                            
                            # 메타데이터 JSON 파싱
                            metadata_json = data[4:4+metadata_length].decode('utf-8')
                            metadata = json.loads(metadata_json)
                            sample_rate = metadata.get('sampleRate', 44100)
                            
                            # 오디오 데이터 추출
                            audio_chunk = data[4+metadata_length:]
                            
                            # STT 처리
                            await stt_manager.process_audio(lecture_id, audio_chunk, sample_rate)
                            
                        # 텍스트 메시지 처리
                        elif "text" in message:
                            text_data = message.get("text")
                            try:
                                data = json.loads(text_data)
                                logger.debug(f"📝 [STT] 텍스트 메시지 수신: {data}")
                            except json.JSONDecodeError:
                                logger.debug(f"📝 [STT] 일반 텍스트 메시지 수신: {text_data}")
                        
                        # 연결 닫기 이벤트 처리
                        elif message.get("type") == "websocket.disconnect":
                            logger.info(f"🔌 [STT] WebSocket 연결 종료 요청 - lecture_id: {lecture_id}, user_id: {user_id}")
                            break
                            
                    except json.JSONDecodeError as e:
                        logger.error(f"❌ [STT] JSON 파싱 오류: {e}")
                        continue
                    except Exception as e:
                        logger.error(f"❌ [STT] 메시지 처리 오류: {e}")
                        continue
                        
            except WebSocketDisconnect:
                logger.info(f"🔌 [STT] WebSocket 연결 끊김 - lecture_id: {lecture_id}, user_id: {user_id}")
            except Exception as e:
                logger.error(f"❌ [STT] WebSocket 오류: {e}")
            finally:
                stt_manager.disconnect(websocket)
                
        except Exception as e:
            logger.error(f"❌ [STT] 토큰 검증 오류: {e}")
            await websocket.send_text(json.dumps({
                "type": "auth_response",
                "status": "error",
                "message": "토큰 검증 중 오류가 발생했습니다."
            }))
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
    except Exception as e:
        logger.error(f"❌ [STT] WebSocket 처리 중 예외 발생: {e}")
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except:
            pass

@router.get("/ws/stt/stats")
async def get_stt_stats():
    """STT 연결 통계"""
    total_connections = sum(len(conns) for conns in stt_manager.active_connections.values())
    active_lectures = len(stt_manager.active_connections)
    
    stats = {
        "total_stt_connections": total_connections,
        "active_stt_lectures": active_lectures,
        "stt_lecture_details": {}
    }
    
    for lecture_id, connections in stt_manager.active_connections.items():
        stats["stt_lecture_details"][lecture_id] = {
            "connections": len(connections),
            "recorder_ready": lecture_id in stt_manager.recorder_ready and stt_manager.recorder_ready[lecture_id].is_set()
        }
    
    return stats 