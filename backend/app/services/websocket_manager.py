from fastapi import WebSocket
from typing import Dict, Tuple

class WebSocketManager:
    def __init__(self):
        # user_id -> (WebSocket, lecture_id)
        self.connections: Dict[int, Tuple[WebSocket, int]] = {}

    async def connect(self, websocket: WebSocket, user_id: int, lecture_id: int):
        """사용자 연결"""
        await websocket.accept()
        self.connections[user_id] = (websocket, lecture_id)
        print(f"User {user_id} connected to lecture {lecture_id}")

    async def disconnect(self, user_id: int):
        """사용자 연결 해제"""
        if user_id in self.connections:
            del self.connections[user_id]
            print(f"User {user_id} disconnected")

    def get_lecture_participants(self, lecture_id: int) -> list:
        """특정 강의의 참가자 목록 반환"""
        participants = []
        for user_id, (websocket, user_lecture_id) in self.connections.items():
            if user_lecture_id == lecture_id:
                participants.append({
                    "user_id": user_id,
                    "is_online": True
                })
        return participants

    async def broadcast_to_lecture(self, message: str, lecture_id: int):
        """특정 강의실의 모든 사용자에게 메시지 브로드캐스트"""
        for user_id, (websocket, user_lecture_id) in self.connections.items():
            if user_lecture_id == lecture_id:
                try:
                    await websocket.send_text(message)
                except Exception as e:
                    print(f"Failed to send message to user {user_id}: {e}")
                    # 연결이 끊어진 경우 정리
                    await self.disconnect(user_id)

    async def send_to_user(self, message: str, user_id: int, lecture_id: int):
        """특정 사용자에게 메시지 전송"""
        connection = self.connections.get(user_id)
        if connection and connection[1] == lecture_id:
            try:
                await connection[0].send_text(message)
            except Exception as e:
                print(f"Failed to send message to user {user_id}: {e}")
                # 연결이 끊어진 경우 정리
                await self.disconnect(user_id) 