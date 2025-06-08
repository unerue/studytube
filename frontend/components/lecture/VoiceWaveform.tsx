'use client';

import { useEffect, useRef } from 'react';

interface VoiceWaveformProps {
  audioLevel: number;
  isActive: boolean;
  width?: number;
  height?: number;
}

export default function VoiceWaveform({ 
  audioLevel, 
  isActive, 
  width = 200, 
  height = 60 
}: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // 최근 오디오 레벨 유지 (애니메이션용)
  const audioLevelsRef = useRef<number[]>(Array(30).fill(0));
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 새 오디오 레벨 추가
    if (isActive) {
      audioLevelsRef.current.push(audioLevel);
      audioLevelsRef.current.shift();
    }
    
    // 캔버스 초기화
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!isActive) {
      // 비활성 상태일 때
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('음성 비활성화', canvas.width / 2, canvas.height / 2);
      return;
    }

    // 배경 그리기
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 파형 그리기
    const barWidth = canvas.width / audioLevelsRef.current.length;
    const center = canvas.height / 2;
    
    // 선 그라디언트 설정
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, '#10b981'); // 초록색
    gradient.addColorStop(0.5, '#06b6d4'); // 청록색
    gradient.addColorStop(1, '#3b82f6'); // 파란색
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    // 경로 그리기
    ctx.beginPath();
    ctx.moveTo(0, center);
    
    audioLevelsRef.current.forEach((level, i) => {
      // 사인파 모양으로 값 조정
      const x = i * barWidth;
      const amplitude = level * (canvas.height * 0.4);
      const y = center + Math.sin(i * 0.4) * amplitude;
      ctx.lineTo(x, y);
    });
    
    ctx.stroke();
    
    // 하이라이트 그리기 (최신 값 주변)
    if (audioLevel > 0.02) {
      ctx.beginPath();
      const lastIndex = audioLevelsRef.current.length - 1;
      const x = lastIndex * barWidth;
      const amplitude = audioLevel * (canvas.height * 0.4);
      const y = center + Math.sin(lastIndex * 0.4) * amplitude;
      
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
    }
  }, [audioLevel, isActive]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border border-white/20 rounded-lg bg-gray-800"
        style={{ width: `${width}px`, height: `${height}px` }}
      />
      {isActive && (
        <div className="absolute top-2 right-2">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
        </div>
      )}
    </div>
  );
} 