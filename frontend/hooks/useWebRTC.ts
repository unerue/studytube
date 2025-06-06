import { useState, useRef, useCallback, useEffect } from 'react';
import adapter from 'webrtc-adapter';

interface WebRTCConfig {
  iceServers: RTCIceServer[];
}

interface PeerConnection {
  id: string;
  connection: RTCPeerConnection;
  isInstructor: boolean;
}

interface UseWebRTCProps {
  wsConnection: WebSocket | null;
  isInstructor: boolean;
  lectureId: string;
}

export function useWebRTC({ wsConnection, isInstructor, lectureId }: UseWebRTCProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const peerConnections = useRef<Map<string, PeerConnection>>(new Map());

  // webrtc-adapter 정보 로그
  useEffect(() => {
    console.log('WebRTC Adapter loaded:', {
      browser: adapter.browserDetails.browser,
      version: adapter.browserDetails.version,
      webrtcSupported: !!navigator.mediaDevices?.getUserMedia
    });
  }, []);
  
  // WebRTC 설정 (기본 STUN 서버 사용)
  const rtcConfig: WebRTCConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  // 새로운 피어 연결 생성
  const createPeerConnection = useCallback((peerId: string, isInitiator: boolean = false): RTCPeerConnection => {
    const pc = new RTCPeerConnection(rtcConfig);
    
    // ICE candidate 이벤트 처리
    pc.onicecandidate = (event) => {
      if (event.candidate && wsConnection) {
        wsConnection.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
          targetPeerId: peerId,
          lectureId
        }));
      }
    };

    // 원격 스트림 수신 처리
    pc.ontrack = (event) => {
      console.log(`[${isInstructor ? 'Instructor' : 'Student'}] ontrack event:`, {
        peerId,
        trackKind: event.track.kind,
        trackId: event.track.id,
        streamIds: event.streams.map(s => s.id),
        streamCount: event.streams.length,
        trackEnabled: event.track.enabled,
        trackMuted: event.track.muted,
        trackReadyState: event.track.readyState
      });

      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        let stream = newMap.get(peerId);

        if (!stream) {
          stream = new MediaStream();
          console.log(`[${isInstructor ? 'Instructor' : 'Student'}] Created new MediaStream for peer ${peerId}`);
        }

        // 스트림에 트랙이 이미 있는지 확인하고 추가
        const existingTrack = stream.getTrackById(event.track.id);
        if (!existingTrack) {
          stream.addTrack(event.track);
          console.log(`[${isInstructor ? 'Instructor' : 'Student'}] Added ${event.track.kind} track ${event.track.id} to stream for peer ${peerId}`);
          console.log(`[${isInstructor ? 'Instructor' : 'Student'}] Stream for ${peerId} now has:`, {
            totalTracks: stream.getTracks().length,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            tracks: stream.getTracks().map(t => ({ id: t.id, kind: t.kind, enabled: t.enabled, readyState: t.readyState }))
          });
        } else {
          console.log(`[${isInstructor ? 'Instructor' : 'Student'}] Track ${event.track.id} (${event.track.kind}) already exists for peer ${peerId}`);
        }

        newMap.set(peerId, stream);
        return newMap;
      });

      // 트랙 이벤트 리스너 추가
      event.track.onended = () => {
        console.log(`[${isInstructor ? 'Instructor' : 'Student'}] Track ${event.track.id} (${event.track.kind}) ended for peer ${peerId}`);
      };

      event.track.onmute = () => {
        console.log(`[${isInstructor ? 'Instructor' : 'Student'}] Track ${event.track.id} (${event.track.kind}) muted for peer ${peerId}`);
      };

      event.track.onunmute = () => {
        console.log(`[${isInstructor ? 'Instructor' : 'Student'}] Track ${event.track.id} (${event.track.kind}) unmuted for peer ${peerId}`);
      };
    };

    // 연결 상태 모니터링
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${peerId}:`, pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        cleanupPeerConnection(peerId);
      }
    };

    peerConnections.current.set(peerId, {
      id: peerId,
      connection: pc,
      isInstructor: !isInitiator
    });

    return pc;
  }, [wsConnection, lectureId]);

  // 피어 연결 정리
  const cleanupPeerConnection = useCallback((peerId: string) => {
    const peerConnection = peerConnections.current.get(peerId);
    if (peerConnection) {
      peerConnection.connection.close();
      peerConnections.current.delete(peerId);
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.delete(peerId);
        return newMap;
      });
    }
  }, []);

  // Offer 생성 및 전송 (강사가 화면 공유 시작할 때)
  const createOffer = useCallback(async (peerId: string) => {
    if (!isInstructor || !localStream) {
      console.log('Cannot create offer: not instructor or no local stream');
      return;
    }

    const pc = createPeerConnection(peerId, true);
    
    // 로컬 스트림 추가 (화면 공유 스트림)
    localStream.getTracks().forEach(track => {
      console.log('Adding track to peer connection:', track.kind);
      pc.addTrack(track, localStream);
    });

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      console.log('Created offer for peer:', peerId);
      
      if (wsConnection) {
        wsConnection.send(JSON.stringify({
          type: 'offer',
          offer: offer,
          targetPeerId: peerId,
          lectureId
        }));
      }
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }, [isInstructor, localStream, wsConnection, lectureId, createPeerConnection]);

  // Answer 생성 및 전송 (학생이 offer를 받았을 때)
  const createAnswer = useCallback(async (peerId: string, offer: RTCSessionDescriptionInit) => {
    const pc = createPeerConnection(peerId, false);
    
    try {
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      if (wsConnection) {
        wsConnection.send(JSON.stringify({
          type: 'answer',
          answer: answer,
          targetPeerId: peerId,
          lectureId
        }));
      }
    } catch (error) {
      console.error('Error creating answer:', error);
    }
  }, [wsConnection, lectureId, createPeerConnection]);

  // Answer 처리 (강사가 학생의 answer를 받았을 때)
  const handleAnswer = useCallback(async (peerId: string, answer: RTCSessionDescriptionInit) => {
    const peerConnection = peerConnections.current.get(peerId);
    if (peerConnection) {
      try {
        await peerConnection.connection.setRemoteDescription(answer);
      } catch (error) {
        console.error('Error setting remote description:', error);
      }
    }
  }, []);

  // ICE candidate 처리
  const handleIceCandidate = useCallback(async (peerId: string, candidate: RTCIceCandidateInit) => {
    const peerConnection = peerConnections.current.get(peerId);
    if (peerConnection && peerConnection.connection.remoteDescription) {
      try {
        await peerConnection.connection.addIceCandidate(candidate);
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  }, []);

  // 화면 공유 중지
  const stopScreenShare = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setIsScreenSharing(false);

    // 모든 피어 연결 정리
    peerConnections.current.forEach((_, peerId) => {
      cleanupPeerConnection(peerId);
    });

    // WebSocket으로 화면 공유 중지 알림 (기존 방식 + WebRTC signaling)
    if (wsConnection) {
      // 1. 기존 화면공유 상태 메시지 (LiveLectureRoom에서 처리)
      wsConnection.send(JSON.stringify({
        type: 'screen_share',
        is_sharing: false
      }));
      
      // 2. WebRTC signaling 메시지
      wsConnection.send(JSON.stringify({
        type: 'screen_share_stopped',
        lectureId
      }));
    }

    console.log('Screen sharing stopped');
  }, [localStream, wsConnection, lectureId, cleanupPeerConnection]);

  // 화면 공유 시작
  const startScreenShare = useCallback(async () => {
    if (!isInstructor) return;

    try {
      const displayMediaOptions = {
        video: true,
        audio: true
      };
      const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

      setLocalStream(stream);
      setIsScreenSharing(true);

      // 스트림이 종료될 때 처리
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      // WebSocket으로 화면 공유 시작 알림 (기존 방식 + WebRTC signaling)
      if (wsConnection) {
        // 1. 기존 화면공유 상태 메시지 (LiveLectureRoom에서 처리)
        wsConnection.send(JSON.stringify({
          type: 'screen_share',
          is_sharing: true
        }));
        
        // 2. WebRTC signaling 메시지 (학생들이 연결 요청을 보낼 수 있도록)
        wsConnection.send(JSON.stringify({
          type: 'screen_share_started',
          lectureId
        }));
      }

      console.log('Screen sharing started successfully');
    } catch (error) {
      console.error('Error starting screen share:', error);
      throw error;
    }
  }, [isInstructor, wsConnection, lectureId, stopScreenShare]);

  // WebSocket 메시지 처리
  useEffect(() => {
    if (!wsConnection) return;

    const handleMessage = async (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      console.log(`[${isInstructor ? 'Instructor' : 'Student'}] WebRTC message:`, data);
      
      switch (data.type) {
        case 'screen_share_started':
          // 학생: 강사가 화면 공유를 시작했을 때 연결 요청
          if (!isInstructor && data.instructorId) {
            console.log('Instructor started screen sharing, requesting connection...');
            // 강사에게 연결 요청 메시지 전송
            if (wsConnection) {
              wsConnection.send(JSON.stringify({
                type: 'request_connection',
                targetInstructorId: data.instructorId,
                lectureId
              }));
            }
          }
          break;

        case 'request_connection':
          // 강사: 학생이 연결을 요청했을 때 offer 생성
          if (isInstructor && isScreenSharing && data.fromStudentId) {
            console.log('Student requesting connection, creating offer...');
            await createOffer(data.fromStudentId);
          }
          break;

        case 'participants_update':
          // 강사: 새 참가자가 들어왔고 화면 공유 중이면 offer 생성
          if (isInstructor && isScreenSharing && data.participants) {
            const newParticipants = data.participants.filter((p: any) => !peerConnections.current.has(p.user_id));
            for (const participant of newParticipants) {
              if (participant.user_id !== data.currentUserId) { // 자기 자신 제외
                console.log('New participant joined, creating offer:', participant.user_id);
                await createOffer(participant.user_id);
              }
            }
          }
          break;

        case 'offer':
          // 학생: offer를 받았을 때 answer 생성
          if (!isInstructor && data.offer && data.fromPeerId) {
            console.log('Received offer from instructor, creating answer...');
            await createAnswer(data.fromPeerId, data.offer);
          }
          break;

        case 'answer':
          // 강사: answer를 받았을 때 처리
          if (isInstructor && data.answer && data.fromPeerId) {
            console.log('Received answer from student, setting remote description...');
            await handleAnswer(data.fromPeerId, data.answer);
          }
          break;

        case 'ice-candidate':
          // ICE candidate 처리
          if (data.candidate && data.fromPeerId) {
            console.log('Received ICE candidate from:', data.fromPeerId);
            await handleIceCandidate(data.fromPeerId, data.candidate);
          }
          break;

        case 'screen_share_stopped':
          // 화면 공유 중지 처리
          console.log('Screen sharing stopped, cleaning up connections...');
          setRemoteStreams(new Map());
          peerConnections.current.forEach((_, peerId) => {
            cleanupPeerConnection(peerId);
          });
          setIsScreenSharing(false);
          break;
      }
    };

    wsConnection.addEventListener('message', handleMessage);
    
    return () => {
      wsConnection.removeEventListener('message', handleMessage);
    };
  }, [wsConnection, isInstructor, isScreenSharing, createOffer, createAnswer, handleAnswer, handleIceCandidate, cleanupPeerConnection]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      peerConnections.current.forEach(({ connection }) => {
        connection.close();
      });
      peerConnections.current.clear();
    };
  }, [localStream]);

  return {
    localStream,
    remoteStreams,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
    createOffer
  };
} 