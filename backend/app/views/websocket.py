from fastapi import WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from fastapi.routing import APIRouter
from typing import Dict, List
import json
from datetime import datetime
from sqlmodel import Session, select
from ..db.database import get_db
from ..models.user import User
from ..models.lecture import Lecture, LectureParticipant
from ..models.chat import ChatMessage
from ..services.auth import decode_token
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # lecture_id를 키로 하는 연결 관리
        self.active_connections: Dict[int, List[WebSocket]] = {}
        # WebSocket과 사용자 정보 매핑
        self.connection_info: Dict[WebSocket, Dict] = {}

    async def connect(self, websocket: WebSocket, lecture_id: int, user_id: int, username: str):
        await websocket.accept()
        
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
                print(f"기존 연결 제거: user_id={user_id}, username={username}")
                self.disconnect(existing_ws)
        
        if lecture_id not in self.active_connections:
            self.active_connections[lecture_id] = []
        
        self.active_connections[lecture_id].append(websocket)
        self.connection_info[websocket] = {
            "lecture_id": lecture_id,
            "user_id": user_id,
            "username": username
        }

    def disconnect(self, websocket: WebSocket):
        connection_info = self.connection_info.get(websocket)
        if connection_info:
            lecture_id = connection_info["lecture_id"]
            if lecture_id in self.active_connections:
                if websocket in self.active_connections[lecture_id]:
                    self.active_connections[lecture_id].remove(websocket)
                if not self.active_connections[lecture_id]:
                    del self.active_connections[lecture_id]
            del self.connection_info[websocket]

    async def send_personal_message(self, message: str, websocket: WebSocket):
        try:
            await websocket.send_text(message)
        except:
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
                            print(f"메시지 전송 성공 - user_id: {user_id}, lecture_id: {lecture_id}")
                            return True
                        except Exception as e:
                            print(f"메시지 전송 실패 - user_id: {user_id}, error: {e}")
                            # 연결이 끊어진 경우 정리
                            self.disconnect(websocket)
                            return False
        print(f"사용자를 찾을 수 없음 - user_id: {user_id}, lecture_id: {lecture_id}")
        return False

    async def broadcast_to_lecture(self, message: str, lecture_id: int):
        if lecture_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[lecture_id]:
                try:
                    await connection.send_text(message)
                except:
                    # 연결이 끊어진 경우 나중에 제거하기 위해 기록
                    disconnected.append(connection)
            
            # 끊어진 연결들 제거
            for conn in disconnected:
                self.disconnect(conn)

    def get_participants(self, lecture_id: int) -> List[Dict]:
        """특정 강의의 현재 접속 중인 참여자 목록 반환 (중복 제거)"""
        participants = []
        seen_user_ids = set()
        
        if lecture_id in self.active_connections:
            for websocket in self.active_connections[lecture_id]:
                if websocket in self.connection_info:
                    info = self.connection_info[websocket]
                    user_id = info["user_id"]
                    
                    # 이미 추가된 사용자는 건너뛰기
                    if user_id not in seen_user_ids:
                        participants.append({
                            "user_id": user_id,
                            "username": info["username"],
                            "is_online": True
                        })
                        seen_user_ids.add(user_id)
        
        print(f"강의 {lecture_id} 참가자 목록 (중복 제거 후): {len(participants)}명")
        return participants

manager = ConnectionManager()

@router.websocket("/ws/chat/{lecture_id}")
async def websocket_endpoint(websocket: WebSocket, lecture_id: int, token: str = Query(None)):
    # 쿼리 파라미터에서 토큰 가져오기 (수동으로)
    query_string = str(websocket.url.query)
    print(f"WebSocket 연결 시도 - lecture_id: {lecture_id}")
    print(f"전체 URL: {websocket.url}")
    print(f"쿼리 스트링: {query_string}")
    print(f"FastAPI 파라미터 token: {'exists' if token else 'missing'}")
    
    # 수동으로 토큰 파싱 시도
    if not token and 'token=' in query_string:
        import urllib.parse
        parsed_query = urllib.parse.parse_qs(query_string)
        if 'token' in parsed_query:
            token = parsed_query['token'][0]
            print(f"수동 파싱으로 토큰 발견: {token[:20]}...")
    
    if not token:
        print("⚠️ 토큰이 없음 - 테스트를 위해 임시로 연결 허용")
        # 임시 테스트 사용자 정보
        user_id = 999
        username = "test_user"
    else:
        # 정상 토큰 검증 진행
        print(f"토큰 검증 시도: {token[:20]}...")
        payload = decode_token(token)
        
        if payload is None:
            print("토큰 검증 실패 - payload가 None")
            await websocket.close(code=1008, reason="토큰 검증 실패")
            return
            
        print(f"토큰 검증 성공: {payload}")
        
        user_id = payload.get("user_id")
        username = payload.get("sub")  # JWT의 sub 필드에 username이 저장됨
        
        print(f"사용자 정보 - user_id: {user_id}, username: {username}")
        
        if not user_id or not username:
            print("사용자 정보 부족 - 연결 거부")
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
                    print(f"WebSocket 연결 성공 - user_id: {user_id}, username: {username}, role: {user.role}, lecture_id: {lecture_id}")
                else:
                    print(f"WebSocket 연결 성공 - user_id: {user_id}, username: {username}, role: 알 수 없음, lecture_id: {lecture_id}")
                break
        else:
            print(f"WebSocket 연결 성공 (테스트 모드) - user_id: {user_id}, username: {username}, lecture_id: {lecture_id}")
        
        await manager.connect(websocket, lecture_id, user_id, username)
        
        # 입장 메시지 브로드캐스트
        join_message = {
            "type": "user_joined",
            "username": username,
            "message": f"{username}님이 참여했습니다.",
            "timestamp": datetime.now().isoformat()
        }
        print(f"입장 메시지 브로드캐스트: {join_message}")
        await manager.broadcast_to_lecture(json.dumps(join_message), lecture_id)
        
        # 참가자 목록 브로드캐스트
        participants = manager.get_participants(lecture_id)
        participants_message = {
            "type": "participants_update",
            "participants": participants,
            "currentUserId": user_id,  # 현재 사용자 ID 추가
            "timestamp": datetime.now().isoformat()
        }
        await manager.broadcast_to_lecture(json.dumps(participants_message), lecture_id)
        
        while True:
            # 클라이언트로부터 메시지 수신
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # 메시지 타입 처리
            if message_data.get("type") == "chat_message":
                chat_message = {
                    "type": "chat_message",
                    "user_id": user_id,
                    "username": username,
                    "message": message_data.get("message", ""),
                    "is_private": message_data.get("is_private", False),
                    "timestamp": datetime.now().isoformat()
                }
                
                # 모든 강의 참가자에게 브로드캐스트
                await manager.broadcast_to_lecture(json.dumps(chat_message), lecture_id)
                
            elif message_data.get("type") == "screen_share":
                # 화면 공유 상태 변경 (기존 방식 유지)
                is_sharing = message_data.get("is_sharing", False)
                print(f"화면공유 상태 변경 - username: {username}, is_sharing: {is_sharing}")
                
                screen_share_message = {
                    "type": "screen_share",
                    "user_id": user_id,
                    "username": username,
                    "is_sharing": is_sharing,
                    "timestamp": datetime.now().isoformat()
                }
                print(f"화면공유 메시지 브로드캐스트: {screen_share_message}")
                await manager.broadcast_to_lecture(json.dumps(screen_share_message), lecture_id)
                
            # WebRTC Signaling 메시지 처리
            elif message_data.get("type") == "screen_share_started":
                # 강사가 화면 공유를 시작했을 때
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
                offer_message = {
                    "type": "offer",
                    "offer": message_data.get("offer"),
                    "fromPeerId": user_id,
                    "targetPeerId": message_data.get("targetPeerId"),
                    "lectureId": lecture_id,
                    "timestamp": datetime.now().isoformat()
                }
                # 특정 대상에게만 전달
                target_peer_id = message_data.get("targetPeerId")
                if target_peer_id:
                    await manager.send_to_user(json.dumps(offer_message), target_peer_id, lecture_id)
                    
            elif message_data.get("type") == "answer":
                # WebRTC Answer 전달
                answer_message = {
                    "type": "answer",
                    "answer": message_data.get("answer"),
                    "fromPeerId": user_id,
                    "targetPeerId": message_data.get("targetPeerId"),
                    "lectureId": lecture_id,
                    "timestamp": datetime.now().isoformat()
                }
                # 특정 대상에게만 전달
                target_peer_id = message_data.get("targetPeerId")
                if target_peer_id:
                    await manager.send_to_user(json.dumps(answer_message), target_peer_id, lecture_id)
                    
            elif message_data.get("type") == "ice-candidate":
                # ICE Candidate 전달
                candidate_message = {
                    "type": "ice-candidate",
                    "candidate": message_data.get("candidate"),
                    "fromPeerId": user_id,
                    "targetPeerId": message_data.get("targetPeerId"),
                    "lectureId": lecture_id,
                    "timestamp": datetime.now().isoformat()
                }
                # 특정 대상에게만 전달
                target_peer_id = message_data.get("targetPeerId")
                if target_peer_id:
                    await manager.send_to_user(json.dumps(candidate_message), target_peer_id, lecture_id)
    
    except WebSocketDisconnect:
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
            await manager.broadcast_to_lecture(json.dumps(leave_message), lecture_id)
            
            # 업데이트된 참여자 목록 브로드캐스트
            participants = manager.get_participants(lecture_id)
            participants_update = {
                "type": "participants_update",
                "participants": participants,
                "timestamp": datetime.now().isoformat()
            }
            await manager.broadcast_to_lecture(json.dumps(participants_update), lecture_id)
    except Exception as e:
        print(f"WebSocket 에러: {e}")
        print(f"에러 타입: {type(e)}")
        import traceback
        print(f"전체 스택 트레이스: {traceback.format_exc()}")
        try:
            await websocket.close(code=1011, reason="서버 오류")
        except:
            pass

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
    """현재 강의의 실시간 참여자 목록 조회"""
    participants = manager.get_participants(lecture_id)
    return {
        "lecture_id": lecture_id,
        "participants": participants,
        "count": len(participants)
    } 