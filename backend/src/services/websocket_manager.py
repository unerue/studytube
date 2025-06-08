from fastapi import WebSocket
from typing import Dict, Tuple
import logging
import time
from datetime import datetime

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WebSocketManager:
    def __init__(self):
        # user_id -> (WebSocket, lecture_id)
        self.connections: Dict[int, Tuple[WebSocket, int]] = {}
        # 연결 메트릭 추적
        self.metrics = {
            "total_connections": 0,
            "total_disconnections": 0,
            "total_messages_sent": 0,
            "total_failed_messages": 0,
            "start_time": datetime.now().isoformat(),
            "connection_history": []
        }
        
        logger.info("🚀 [WebSocket] WebSocketManager 초기화 완료")

    async def connect(self, websocket: WebSocket, user_id: int, lecture_id: int):
        """사용자 연결"""
        connection_start = time.time()
        
        await websocket.accept()
        
        # 기존 연결이 있는지 확인
        if user_id in self.connections:
            old_lecture_id = self.connections[user_id][1]
            logger.warning(f"🔄 [WebSocket] 기존 연결 교체 - user_id: {user_id}, "
                          f"이전 강의: {old_lecture_id} → 새 강의: {lecture_id}")
        else:
            logger.info(f"🆕 [WebSocket] 새 연결 생성 - user_id: {user_id}")
        
        self.connections[user_id] = (websocket, lecture_id)
        
        # 메트릭 업데이트
        self.metrics["total_connections"] += 1
        connection_time = time.time() - connection_start
        
        connection_info = {
            "user_id": user_id,
            "lecture_id": lecture_id,
            "connected_at": datetime.now().isoformat(),
            "connection_time": connection_time
        }
        self.metrics["connection_history"].append(connection_info)
        
        # 연결 히스토리는 최근 100개만 유지
        if len(self.metrics["connection_history"]) > 100:
            self.metrics["connection_history"] = self.metrics["connection_history"][-100:]
        
        logger.info(f"✅ [WebSocket] 연결 완료 - user_id: {user_id}, lecture_id: {lecture_id}")
        logger.info(f"📊 [WebSocket] 연결 시간: {connection_time:.3f}s, 총 활성 연결: {len(self.connections)}")

    async def disconnect(self, user_id: int):
        """사용자 연결 해제"""
        if user_id in self.connections:
            lecture_id = self.connections[user_id][1]
            del self.connections[user_id]
            
            self.metrics["total_disconnections"] += 1
            
            logger.info(f"🔴 [WebSocket] 연결 해제 - user_id: {user_id}, lecture_id: {lecture_id}")
            logger.info(f"📊 [WebSocket] 남은 활성 연결: {len(self.connections)}")
        else:
            logger.warning(f"⚠️ [WebSocket] 해제할 연결 없음 - user_id: {user_id}")

    def get_lecture_participants(self, lecture_id: int) -> list:
        """특정 강의의 참가자 목록 반환"""
        participants = []
        participant_count = 0
        
        for user_id, (websocket, user_lecture_id) in self.connections.items():
            if user_lecture_id == lecture_id:
                participant_count += 1
                participants.append({
                    "user_id": user_id,
                    "is_online": True
                })
        
        logger.debug(f"👥 [WebSocket] 강의 {lecture_id} 참가자 조회 - {participant_count}명")
        return participants

    async def broadcast_to_lecture(self, message: str, lecture_id: int):
        """특정 강의실의 모든 사용자에게 메시지 브로드캐스트"""
        broadcast_start = time.time()
        
        # 대상 연결 찾기
        target_connections = []
        for user_id, (websocket, user_lecture_id) in self.connections.items():
            if user_lecture_id == lecture_id:
                target_connections.append((user_id, websocket))
        
        if not target_connections:
            logger.warning(f"⚠️ [WebSocket] 브로드캐스트 대상 없음 - lecture_id: {lecture_id}")
            return
        
        logger.info(f"📢 [WebSocket] 브로드캐스트 시작 - lecture_id: {lecture_id}, 대상: {len(target_connections)}명")
        
        success_count = 0
        failed_users = []
        
        for user_id, websocket in target_connections:
            try:
                send_start = time.time()
                await websocket.send_text(message)
                send_time = time.time() - send_start
                
                success_count += 1
                self.metrics["total_messages_sent"] += 1
                
                logger.debug(f"📤 [WebSocket] 메시지 전송 성공 - user_id: {user_id}, 시간: {send_time:.3f}s")
                
            except Exception as e:
                failed_users.append(user_id)
                self.metrics["total_failed_messages"] += 1
                
                logger.error(f"❌ [WebSocket] 메시지 전송 실패 - user_id: {user_id}, 오류: {e}")
                
                # 연결이 끊어진 경우 정리
                await self.disconnect(user_id)
        
        broadcast_time = time.time() - broadcast_start
        
        logger.info(f"✅ [WebSocket] 브로드캐스트 완료 - lecture_id: {lecture_id}")
        logger.info(f"📊 [WebSocket] 성공: {success_count}, 실패: {len(failed_users)}, 총 시간: {broadcast_time:.3f}s")
        
        if failed_users:
            logger.warning(f"❌ [WebSocket] 실패한 user_id 목록: {failed_users}")

    async def send_to_user(self, message: str, user_id: int, lecture_id: int):
        """특정 사용자에게 메시지 전송"""
        send_start = time.time()
        
        connection = self.connections.get(user_id)
        if connection and connection[1] == lecture_id:
            websocket = connection[0]
            
            try:
                await websocket.send_text(message)
                send_time = time.time() - send_start
                
                self.metrics["total_messages_sent"] += 1
                
                logger.info(f"📧 [WebSocket] 개별 메시지 전송 성공 - user_id: {user_id}, "
                           f"lecture_id: {lecture_id}, 시간: {send_time:.3f}s")
                
            except Exception as e:
                self.metrics["total_failed_messages"] += 1
                
                logger.error(f"❌ [WebSocket] 개별 메시지 전송 실패 - user_id: {user_id}, "
                            f"lecture_id: {lecture_id}, 오류: {e}")
                
                # 연결이 끊어진 경우 정리
                await self.disconnect(user_id)
        else:
            logger.warning(f"⚠️ [WebSocket] 전송 대상 없음 - user_id: {user_id}, lecture_id: {lecture_id}")
            if user_id in self.connections:
                actual_lecture_id = self.connections[user_id][1]
                logger.warning(f"⚠️ [WebSocket] 사용자는 다른 강의에 연결됨 - 실제 강의: {actual_lecture_id}")

    def get_connection_stats(self) -> dict:
        """연결 통계 반환"""
        uptime_seconds = (datetime.now() - datetime.fromisoformat(self.metrics["start_time"])).total_seconds()
        
        # 강의별 연결 수 계산
        lecture_stats = {}
        for user_id, (websocket, lecture_id) in self.connections.items():
            if lecture_id not in lecture_stats:
                lecture_stats[lecture_id] = 0
            lecture_stats[lecture_id] += 1
        
        stats = {
            "active_connections": len(self.connections),
            "total_connections_created": self.metrics["total_connections"],
            "total_disconnections": self.metrics["total_disconnections"],
            "total_messages_sent": self.metrics["total_messages_sent"],
            "total_failed_messages": self.metrics["total_failed_messages"],
            "uptime_seconds": uptime_seconds,
            "lecture_stats": lecture_stats,
            "success_rate": (
                (self.metrics["total_messages_sent"] / 
                 (self.metrics["total_messages_sent"] + self.metrics["total_failed_messages"]) * 100)
                if (self.metrics["total_messages_sent"] + self.metrics["total_failed_messages"]) > 0 else 100
            ),
            "start_time": self.metrics["start_time"]
        }
        
        logger.debug(f"📊 [WebSocket] 통계 조회 - 활성 연결: {len(self.connections)}, "
                    f"성공률: {stats['success_rate']:.1f}%")
        
        return stats

    def cleanup_stale_connections(self):
        """유효하지 않은 연결 정리"""
        cleanup_start = time.time()
        
        stale_users = []
        for user_id, (websocket, lecture_id) in list(self.connections.items()):
            try:
                # WebSocket 상태 확인 (간단한 체크)
                if websocket.client_state.name == 'DISCONNECTED':
                    stale_users.append(user_id)
            except Exception as e:
                logger.warning(f"⚠️ [WebSocket] 연결 상태 확인 실패 - user_id: {user_id}, 오류: {e}")
                stale_users.append(user_id)
        
        # 유효하지 않은 연결 제거
        for user_id in stale_users:
            if user_id in self.connections:
                lecture_id = self.connections[user_id][1]
                del self.connections[user_id]
                self.metrics["total_disconnections"] += 1
                
                logger.info(f"🧹 [WebSocket] 유효하지 않은 연결 정리 - user_id: {user_id}, lecture_id: {lecture_id}")
        
        cleanup_time = time.time() - cleanup_start
        
        if stale_users:
            logger.info(f"🧹 [WebSocket] 연결 정리 완료 - 제거된 연결: {len(stale_users)}개, "
                       f"소요시간: {cleanup_time:.3f}s")
        
        return len(stale_users)

    def get_lecture_connection_count(self, lecture_id: int) -> int:
        """특정 강의의 연결 수 반환"""
        count = sum(1 for user_id, (websocket, user_lecture_id) in self.connections.items() 
                   if user_lecture_id == lecture_id)
        
        logger.debug(f"📊 [WebSocket] 강의 {lecture_id} 연결 수: {count}")
        return count

    def is_user_connected(self, user_id: int) -> bool:
        """사용자 연결 상태 확인"""
        connected = user_id in self.connections
        
        if connected:
            lecture_id = self.connections[user_id][1]
            logger.debug(f"🔍 [WebSocket] 사용자 연결 상태 - user_id: {user_id}, "
                        f"connected: True, lecture_id: {lecture_id}")
        else:
            logger.debug(f"🔍 [WebSocket] 사용자 연결 상태 - user_id: {user_id}, connected: False")
        
        return connected

    def __del__(self):
        """소멸자 - 정리 작업"""
        if hasattr(self, 'connections') and self.connections:
            logger.info(f"🧹 [WebSocket] WebSocketManager 소멸 - 활성 연결 {len(self.connections)}개 정리")
            final_stats = self.get_connection_stats()
            logger.info(f"📊 [WebSocket] 최종 통계 - 총 연결: {final_stats['total_connections_created']}, "
                       f"총 메시지: {final_stats['total_messages_sent']}, "
                       f"성공률: {final_stats['success_rate']:.1f}%") 