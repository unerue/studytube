'use client';

import { useState, useEffect } from 'react';
import { Button, Spin, message } from 'antd';
import { LeftOutlined, RightOutlined, FullscreenOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';

interface PPTViewerProps {
  pptUrl?: string;
  currentSlide: number;
  totalSlides: number;
  onSlideChange: (slideNumber: number) => void;
  isInstructor?: boolean;
}

export default function PPTViewer({ 
  pptUrl = '/차량용신호등인식_삼육구_강경수.pptx',
  currentSlide, 
  totalSlides, 
  onSlideChange,
  isInstructor = false 
}: PPTViewerProps) {
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    // PPT 파일 로드 시뮬레이션
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [pptUrl]);

  const handleSlideNavigation = (direction: 'prev' | 'next') => {
    if (!isInstructor) return; // 강사만 슬라이드 변경 가능
    
    if (direction === 'prev' && currentSlide > 1) {
      onSlideChange(currentSlide - 1);
    } else if (direction === 'next' && currentSlide < totalSlides) {
      onSlideChange(currentSlide + 1);
    }
  };

  const handleZoom = (direction: 'in' | 'out') => {
    const newZoom = direction === 'in' 
      ? Math.min(zoom + 25, 200) 
      : Math.max(zoom - 25, 50);
    setZoom(newZoom);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // 실제 PPT 내용 (임시 데이터)
  const generateSlideContent = (slideNumber: number) => {
    const slides = [
      {
        title: "차량용 신호등 인식 AI",
        content: "딥러닝을 활용한 실시간 신호등 인식 시스템",
        image: "🚦",
        bullets: ["YOLO 모델 활용", "실시간 처리", "높은 정확도"]
      },
      {
        title: "연구 배경",
        content: "자율주행 차량의 핵심 기술",
        image: "🚗",
        bullets: ["교통 안전 향상", "자동화 필요성", "기술적 도전과제"]
      },
      {
        title: "데이터셋",
        content: "신호등 이미지 데이터 수집 및 전처리",
        image: "📊",
        bullets: ["10,000개 이미지", "다양한 환경 조건", "라벨링 작업"]
      },
      {
        title: "모델 아키텍처",
        content: "YOLO v8 기반 객체 검출 모델",
        image: "🧠",
        bullets: ["CNN 백본", "FPN 구조", "앵커 박스 최적화"]
      },
      {
        title: "실험 결과",
        content: "성능 평가 및 분석",
        image: "📈",
        bullets: ["mAP: 95.2%", "처리 속도: 30 FPS", "실시간 처리 가능"]
      }
    ];

    return slides[slideNumber - 1] || slides[0];
  };

  const currentSlideContent = generateSlideContent(currentSlide);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100">
        <Spin size="large" />
        <p className="ml-4 text-gray-600">PPT 파일을 로드하는 중...</p>
      </div>
    );
  }

  return (
    <div className={`relative bg-white ${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'}`}>
      {/* PPT 콘텐츠 */}
      <div 
        className="h-full flex items-center justify-center p-8"
        style={{ transform: `scale(${zoom / 100})` }}
      >
        <div className="max-w-4xl mx-auto text-center">
          {/* 슬라이드 헤더 */}
          <div className="mb-8">
            <div className="text-6xl mb-4">{currentSlideContent.image}</div>
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              {currentSlideContent.title}
            </h1>
            <p className="text-xl text-gray-600">
              {currentSlideContent.content}
            </p>
          </div>

          {/* 슬라이드 내용 */}
          <div className="bg-blue-50 p-8 rounded-xl">
            <ul className="text-left space-y-4">
              {currentSlideContent.bullets.map((bullet, index) => (
                <li key={index} className="flex items-center text-lg">
                  <span className="w-3 h-3 bg-blue-500 rounded-full mr-4"></span>
                  {bullet}
                </li>
              ))}
            </ul>
          </div>

          {/* 슬라이드 번호 */}
          <div className="mt-8 text-gray-500">
            {currentSlide} / {totalSlides}
          </div>
        </div>
      </div>

      {/* 컨트롤 바 */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-black bg-opacity-70 px-4 py-2 rounded-lg">
        {/* 슬라이드 네비게이션 (강사만) */}
        {isInstructor && (
          <>
            <Button
              type="text"
              icon={<LeftOutlined />}
              onClick={() => handleSlideNavigation('prev')}
              disabled={currentSlide === 1}
              className="text-white hover:bg-white hover:bg-opacity-20"
              size="small"
            />
            <span className="text-white text-sm px-2">
              {currentSlide} / {totalSlides}
            </span>
            <Button
              type="text"
              icon={<RightOutlined />}
              onClick={() => handleSlideNavigation('next')}
              disabled={currentSlide === totalSlides}
              className="text-white hover:bg-white hover:bg-opacity-20"
              size="small"
            />
            <div className="w-px h-6 bg-gray-400 mx-2"></div>
          </>
        )}

        {/* 줌 컨트롤 */}
        <Button
          type="text"
          icon={<ZoomOutOutlined />}
          onClick={() => handleZoom('out')}
          disabled={zoom === 50}
          className="text-white hover:bg-white hover:bg-opacity-20"
          size="small"
        />
        <span className="text-white text-sm px-2">{zoom}%</span>
        <Button
          type="text"
          icon={<ZoomInOutlined />}
          onClick={() => handleZoom('in')}
          disabled={zoom === 200}
          className="text-white hover:bg-white hover:bg-opacity-20"
          size="small"
        />

        <div className="w-px h-6 bg-gray-400 mx-2"></div>

        {/* 전체화면 */}
        <Button
          type="text"
          icon={<FullscreenOutlined />}
          onClick={toggleFullscreen}
          className="text-white hover:bg-white hover:bg-opacity-20"
          size="small"
        />
      </div>

      {/* 전체화면 닫기 버튼 */}
      {isFullscreen && (
        <Button
          type="text"
          className="absolute top-4 right-4 text-white hover:bg-white hover:bg-opacity-20"
          onClick={() => setIsFullscreen(false)}
        >
          ✕ ESC
        </Button>
      )}

      {/* 강사 전용 알림 */}
      {!isInstructor && (
        <div className="absolute top-4 left-4 bg-blue-500 text-white px-3 py-1 rounded text-sm">
          👀 학생 모드 - 강사가 슬라이드를 조작합니다
        </div>
      )}
    </div>
  );
} 