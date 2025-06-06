'use client';

import { useState, useRef, useEffect } from 'react';
import { Button, Typography, message } from 'antd';
import { 
  DesktopOutlined, 
  StopOutlined,
  VideoCameraOutlined,
  LoadingOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface VideoAreaProps {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isScreenSharing: boolean;
  userRole: 'instructor' | 'student';
  connectionStatus: 'connecting' | 'connected' | 'failed' | 'disconnected';
}

export default function VideoArea({ 
  localStream,
  remoteStreams,
  isScreenSharing,
  userRole,
  connectionStatus
}: VideoAreaProps) {
  const [isLoading, setIsLoading] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // 로컬 스트림 표시 (강사의 화면 공유 미리보기)
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // 원격 스트림 표시 (학생이 받는 강사의 화면)
  useEffect(() => {
    const streamEntries = Array.from(remoteStreams.entries());
    console.log(`[VideoArea-${userRole === 'instructor' ? 'Instructor' : 'Student'}] Remote streams updated:`, {
      streamCount: remoteStreams.size,
      peerIds: Array.from(remoteStreams.keys()),
      streamDetails: streamEntries.map(([peerId, stream]) => ({
        peerId,
        streamId: stream.id,
        totalTracks: stream.getTracks().length,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        tracks: stream.getTracks().map(t => ({
          id: t.id,
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted
        }))
      }))
    });
    
    if (remoteVideoRef.current && remoteStreams.size > 0) {
      // 첫 번째 원격 스트림을 표시 (강사는 한 명이므로)
      const firstStream = Array.from(remoteStreams.values())[0];
      if (firstStream) {
        console.log(`[VideoArea-${userRole === 'instructor' ? 'Instructor' : 'Student'}] Setting remote stream to video element:`, {
          streamId: firstStream.id,
          hasVideoTracks: firstStream.getVideoTracks().length > 0,
          hasAudioTracks: firstStream.getAudioTracks().length > 0,
          videoElement: remoteVideoRef.current
        });
        
        remoteVideoRef.current.srcObject = firstStream;
        
        // 비디오 재생 이벤트 리스너
        remoteVideoRef.current.onloadedmetadata = () => {
          console.log(`[VideoArea-${userRole === 'instructor' ? 'Instructor' : 'Student'}] Video metadata loaded`);
        };
        
        remoteVideoRef.current.onplay = () => {
          console.log(`[VideoArea-${userRole === 'instructor' ? 'Instructor' : 'Student'}] Video started playing`);
        };
        
        remoteVideoRef.current.onerror = (error) => {
          console.error(`[VideoArea-${userRole === 'instructor' ? 'Instructor' : 'Student'}] Video error:`, error);
        };
        
        remoteVideoRef.current.play().catch(error => {
          console.error(`[VideoArea-${userRole === 'instructor' ? 'Instructor' : 'Student'}] Error playing video:`, error);
        });
      }
    } else if (remoteVideoRef.current) {
      // 원격 스트림이 없으면 비디오 엘리먼트 초기화
      console.log(`[VideoArea-${userRole === 'instructor' ? 'Instructor' : 'Student'}] Clearing remote video element`);
      remoteVideoRef.current.srcObject = null;
    }
  }, [remoteStreams, userRole]);

  // 화면 공유 중인 경우 (강사가 공유 중이거나 학생이 원격 스트림 수신 중)
  if ((userRole === 'instructor' && isScreenSharing) || (userRole !== 'instructor' && remoteStreams.size > 0)) {
    return (
      <div className="h-full bg-black flex items-center justify-center relative">
        {/* 메인 화면 공유 비디오 */}
        <video
          ref={userRole === 'instructor' ? localVideoRef : remoteVideoRef}
          className="w-full h-full object-contain"
          autoPlay
          playsInline
          muted={userRole === 'instructor'} // 강사는 자신의 화면이므로 음소거
        />

        {/* 화면 공유 상태 표시 */}
        <div className="absolute top-4 left-4 z-10">
          <div className="bg-red-600 text-white px-3 py-1 rounded-lg text-sm font-medium flex items-center space-x-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span>
              {userRole === 'instructor' ? '화면 공유 중' : 
               remoteStreams.size > 0 ? '강사 화면 공유 수신 중' : '대기 중'}
            </span>
          </div>
        </div>

        {/* 연결 품질 정보 */}
        <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-2 text-white text-xs z-10">
          <div>품질: HD 1080p</div>
          <div>연결: WebRTC P2P</div>
          <div>상태: {connectionStatus}</div>
          {userRole !== 'instructor' && remoteStreams.size > 0 && (
            <>
              <div>원격 스트림: {remoteStreams.size}개</div>
              <div>지연시간: ~100ms</div>
            </>
          )}
          {userRole === 'instructor' && isScreenSharing && (
            <div>로컬 화면 공유 중</div>
          )}
        </div>

        {/* 로딩 오버레이 */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
            <div className="text-white text-center">
              <LoadingOutlined className="text-4xl mb-4" />
              <div>화면 공유를 시작하는 중...</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 화면 공유가 시작되지 않은 경우
  return (
    <div className="h-full bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        {userRole === 'instructor' ? (
          <>
            <VideoCameraOutlined className="text-6xl text-gray-500 mb-6" />
            <Title level={3} className="text-white mb-4">
              화면 공유를 시작하세요
            </Title>
            <Text className="text-gray-400 mb-6 block">
              하단의 화면 공유 버튼을 클릭하여 강의를 시작하세요
            </Text>
          </>
        ) : (
          <>
            <DesktopOutlined className="text-6xl text-gray-500 mb-6" />
            <Title level={3} className="text-white mb-4">
              강사의 화면을 기다리는 중...
            </Title>
            <Text className="text-gray-400 mb-6 block">
              강사가 화면 공유를 시작하면 여기에 표시됩니다
            </Text>
          </>
        )}
        
        {/* 연결 상태 표시 */}
        <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3 text-white text-sm">
          <div>연결 상태: {connectionStatus}</div>
          <div>역할: {userRole === 'instructor' ? '강사' : '학생'}</div>
        </div>
      </div>
    </div>
  );
} 