'use client';

import { useEffect, useRef, useState } from 'react';

interface AudioVisualizerProps {
  mediaRecorder?: MediaRecorder | null;
  isActive: boolean;
  width?: number;
  height?: number;
}

export default function AudioVisualizer({ 
  mediaRecorder, 
  isActive, 
  width = 200, 
  height = 60 
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  
  useEffect(() => {
    if (!mediaRecorder || !isActive) {
      // 정지 상태일 때 애니메이션 중지
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      // Canvas 초기화
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          // 빈 상태 표시
          ctx.fillStyle = '#374151';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#6b7280';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('마이크 대기 중...', canvas.width / 2, canvas.height / 2);
        }
      }
      return;
    }

    // MediaRecorder에서 오디오 스트림 가져오기
    const stream = mediaRecorder.stream;
    if (!stream) return;

    // Web Audio API 설정
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    
    source.connect(analyser);
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    analyserRef.current = analyser;
    dataArrayRef.current = dataArray;

    const drawWaveform = () => {
      if (!isActive || !analyserRef.current || !dataArrayRef.current) return;
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 주파수 데이터 가져오기
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);

      // Canvas 초기화
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 바 그리기
      const barWidth = (canvas.width / dataArrayRef.current.length) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < dataArrayRef.current.length; i++) {
        barHeight = (dataArrayRef.current[i] / 255) * canvas.height * 0.8;

        // 그라디언트 생성
        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        gradient.addColorStop(0, '#3b82f6'); // 파란색
        gradient.addColorStop(0.5, '#06b6d4'); // 청록색
        gradient.addColorStop(1, '#10b981'); // 초록색
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }

      // 실시간 업데이트
      animationRef.current = requestAnimationFrame(drawWaveform);
    };

    drawWaveform();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  }, [mediaRecorder, isActive]);

  return (
    <div className="flex flex-col items-center">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border border-white/20 rounded-lg bg-gray-800"
        style={{ width: `${width}px`, height: `${height}px` }}
      />
      <div className="text-xs text-white/60 mt-1">
        {isActive ? '🔴 녹음 중' : '⏸️ 대기 중'}
      </div>
    </div>
  );
} 