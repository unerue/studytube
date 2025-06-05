'use client';

import { useState, useRef, useEffect } from 'react';
import { Button, Typography, message } from 'antd';
import { 
  DesktopOutlined, 
  StopOutlined,
  FileImageOutlined,
  VideoCameraOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface VideoAreaProps {
  isInstructor: boolean;
  isScreenSharing: boolean;
  onStartScreenShare: () => void;
  onStopScreenShare: () => void;
}

export function VideoArea({ 
  isInstructor, 
  isScreenSharing, 
  onStartScreenShare, 
  onStopScreenShare 
}: VideoAreaProps) {
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 컴포넌트 언마운트 시 스트림 정리
  useEffect(() => {
    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [currentStream]);

  const handleStartScreenShare = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        // 비디오 엘리먼트에 스트림 연결
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        setCurrentStream(stream);
        onStartScreenShare();
        
        message.success('화면 공유가 시작되었습니다');
        
        // 스트림이 종료될 때 처리 (사용자가 직접 중지한 경우)
        stream.getVideoTracks()[0].onended = () => {
          handleStopScreenShare();
          message.info('화면 공유가 종료되었습니다');
        };
      } else {
        message.error('이 브라우저는 화면 공유를 지원하지 않습니다');
      }
    } catch (error) {
      console.error('화면 공유 시작 실패:', error);
      message.error('화면 공유를 시작할 수 없습니다. 권한을 확인해주세요.');
    }
  };

  const handleStopScreenShare = () => {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
      setCurrentStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    onStopScreenShare();
  };

  // 학생의 경우 화면 공유 상태를 시뮬레이션 (실제로는 WebRTC나 Socket으로 스트림을 받아와야 함)
  useEffect(() => {
    if (!isInstructor && isScreenSharing && videoRef.current) {
      // 실제 구현에서는 여기서 강사의 화면 공유 스트림을 받아옴
      // 현재는 시연을 위해 mock 비디오 표시
      const mockVideo = document.createElement('canvas');
      mockVideo.width = 1920;
      mockVideo.height = 1080;
      const ctx = mockVideo.getContext('2d');
      
      if (ctx) {
        // 목업 화면 공유 내용 생성
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(0, 0, mockVideo.width, mockVideo.height);
        ctx.fillStyle = 'white';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('강사의 화면 공유 내용', mockVideo.width / 2, mockVideo.height / 2 - 50);
        ctx.fillText('AI와 머신러닝 강의', mockVideo.width / 2, mockVideo.height / 2 + 50);
        
        const stream = mockVideo.captureStream();
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    }
  }, [isInstructor, isScreenSharing]);

  if (isScreenSharing) {
    return (
      <div className="h-full bg-black flex items-center justify-center relative">
        {/* 화면 공유 비디오 */}
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          autoPlay
          playsInline
        />

        {/* 강사용 화면 공유 중지 버튼 */}
        {isInstructor && (
          <div className="absolute top-4 right-4 z-10">
            <Button 
              type="primary" 
              danger 
              icon={<StopOutlined />}
              onClick={handleStopScreenShare}
              size="large"
            >
              공유 중지
            </Button>
          </div>
        )}

        {/* 화면 공유 상태 표시 */}
        <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-lg text-sm font-medium z-10">
          🔴 {isInstructor ? '화면 공유 중' : '강사 화면 공유 수신 중'}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        {isInstructor ? (
          <>
            <VideoCameraOutlined className="text-6xl text-gray-500 mb-6" />
            <Title level={3} className="text-white mb-4">
              화면 공유를 시작하세요
            </Title>
            <Text className="text-gray-400 mb-6 block">
              PPT, 문서, 브라우저 등을 학생들과 실시간으로 공유할 수 있습니다
            </Text>
            
            <div className="space-y-3">
              <Button 
                type="primary" 
                size="large"
                icon={<DesktopOutlined />}
                onClick={handleStartScreenShare}
                className="w-full max-w-xs"
              >
                화면 공유 시작
              </Button>
              
              <div className="text-xs text-gray-500 max-w-xs mx-auto">
                💡 화면 공유 버튼을 클릭하면 공유할 화면이나 애플리케이션을 선택할 수 있습니다
              </div>
            </div>
          </>
        ) : (
          <>
            <VideoCameraOutlined className="text-6xl text-gray-500 mb-6" />
            <Title level={3} className="text-white mb-4">
              강의를 기다리고 있습니다
            </Title>
            <Text className="text-gray-400">
              강사가 화면 공유를 시작하면 여기에 실시간으로 표시됩니다
            </Text>
          </>
        )}
      </div>
    </div>
  );
} 