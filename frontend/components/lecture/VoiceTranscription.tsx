'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/context/AuthContext';

interface VoiceTranscriptionProps {
  lectureId: number;
  className?: string;
}

interface TranscriptionMessage {
  type: 'realtime' | 'fullSentence' | 'auth' | 'auth_response';
  text?: string;
  status?: string;
  message?: string;
  token?: string;
}

export default function VoiceTranscription({ lectureId, className = '' }: VoiceTranscriptionProps) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [micAvailable, setMicAvailable] = useState(false);
  const [serverAvailable, setServerAvailable] = useState(false);
  const [fullSentences, setFullSentences] = useState<string[]>([]);
  const [realtimeText, setRealtimeText] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('🖥️  서버에 연결 중...  🖥️');

  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connectToServer = useCallback(async () => {
    try {
      // 토큰 가져오기
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.error('인증 토큰이 없습니다');
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const port = process.env.NODE_ENV === 'development' ? '8000' : window.location.port;
      
      // 토큰을 쿼리 파라미터가 아닌 메시지로 전송하기 위해 URL에서 제거
      const wsUrl = `${protocol}//${host}:${port}/ws/stt/${lectureId}`;
      
      socketRef.current = new WebSocket(wsUrl);

      socketRef.current.onopen = () => {
        console.log('STT WebSocket 연결됨, 인증 메시지 전송');
        
        // 인증 메시지 전송
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          const authMessage = JSON.stringify({
            type: 'auth',
            token: token
          });
          socketRef.current.send(authMessage);
        }
        
        setIsConnected(true);
        setServerAvailable(true);
        updateConnectionStatus();
      };

      socketRef.current.onmessage = (event) => {
        try {
          const data: TranscriptionMessage = JSON.parse(event.data);
          
          // 인증 응답 처리
          if (data.type === 'auth_response') {
            if (data.status === 'success') {
              console.log('STT 인증 성공:', data.message);
            } else {
              console.error('STT 인증 실패:', data.message);
              setServerAvailable(false);
              updateConnectionStatus();
            }
            return;
          }
          
          if (data.type === 'realtime') {
            setRealtimeText(data.text);
          } else if (data.type === 'fullSentence') {
            setFullSentences(prev => [...prev, data.text]);
            setRealtimeText(''); // 실시간 텍스트 초기화
          }
        } catch (error) {
          console.error('메시지 파싱 오류:', error);
        }
      };

      socketRef.current.onclose = (event) => {
        console.log('STT WebSocket 연결 끊김', {
          code: event.code,
          reason: event.reason || '이유 없음',
          wasClean: event.wasClean
        });
        
        setIsConnected(false);
        setServerAvailable(false);
        updateConnectionStatus();
        
        // 5초 후 재연결 시도
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          connectToServer();
        }, 5000);
      };

      socketRef.current.onerror = (error) => {
        console.error('STT WebSocket 오류:', error);
        setServerAvailable(false);
        updateConnectionStatus();
      };

    } catch (error) {
      console.error('WebSocket 연결 오류:', error);
      setServerAvailable(false);
      updateConnectionStatus();
    }
  }, [lectureId]);

  const updateConnectionStatus = useCallback(() => {
    if (!micAvailable) {
      setConnectionStatus('🎤  마이크 권한을 허용해주세요  🎤');
    } else if (!serverAvailable) {
      setConnectionStatus('🖥️  서버에 연결 중...  🖥️');
    } else {
      setConnectionStatus('👄  말씀해주세요  👄');
    }
  }, [micAvailable, serverAvailable]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000, // RealtimeSTT 서버가 예상하는 샘플레이트
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      streamRef.current = stream;
      setMicAvailable(true);
      setIsRecording(true);
      updateConnectionStatus();

      // AudioContext 생성 - 16kHz로 설정
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // ScriptProcessorNode 생성 (RealtimeSTT 예제에 맞게 버퍼 크기 조정)
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      processorRef.current.onaudioprocess = (e) => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        const outputData = new Int16Array(inputData.length);

        // Float32Array를 16-bit PCM으로 변환
        for (let i = 0; i < inputData.length; i++) {
          outputData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }

        // 메타데이터 생성 - RealtimeSTT 서버가 예상하는 형식으로
        const metadata = JSON.stringify({ 
          sampleRate: audioContextRef.current?.sampleRate || 16000 
        });
        const metadataBytes = new TextEncoder().encode(metadata);
        
        // 메타데이터 길이를 4바이트로 인코딩
        const metadataLength = new ArrayBuffer(4);
        const metadataLengthView = new DataView(metadataLength);
        metadataLengthView.setInt32(0, metadataBytes.byteLength, true); // little-endian
        
        // 메타데이터 길이 + 메타데이터 + 오디오 데이터 결합
        const combinedData = new Blob([metadataLength, metadataBytes, outputData.buffer]);
        
        socketRef.current.send(combinedData);
      };

    } catch (error) {
      console.error('마이크 접근 오류:', error);
      setConnectionStatus('🎤  마이크 권한이 필요합니다  🎤');
      setMicAvailable(false);
    }
  }, [updateConnectionStatus]);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    updateConnectionStatus();
  }, [updateConnectionStatus]);

  const clearTranscription = useCallback(() => {
    setFullSentences([]);
    setRealtimeText('');
  }, []);

  // 컴포넌트 마운트 시 서버 연결
  useEffect(() => {
    connectToServer();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
      stopRecording();
    };
  }, [connectToServer, stopRecording]);

  // 연결 상태 업데이트
  useEffect(() => {
    updateConnectionStatus();
  }, [updateConnectionStatus]);

  const displayedText = fullSentences
    .map((sentence, index) => (
      <span 
        key={index} 
        className={index % 2 === 0 ? 'text-yellow-600' : 'text-cyan-600'}
      >
        {sentence}{' '}
      </span>
    ))
    .concat([
      <span key="realtime" className="text-gray-600">
        {realtimeText}
      </span>
    ]);

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">실시간 음성 인식</h3>
        <div className="flex gap-2">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={!serverAvailable}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isRecording
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400'
            }`}
          >
            {isRecording ? '🔴 중지' : '🎤 시작'}
          </button>
          <button
            onClick={clearTranscription}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            지우기
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* 연결 상태 */}
        <div className="text-center py-2 px-4 bg-gray-100 rounded-lg">
          <span className="text-sm font-medium">{connectionStatus}</span>
        </div>

        {/* 상태 표시기 */}
        <div className="flex justify-center space-x-4 text-sm">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>서버 연결</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${micAvailable ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>마이크</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
            <span>녹음중</span>
          </div>
        </div>

        {/* 전사 결과 */}
        <div className="min-h-32 max-h-64 overflow-y-auto p-4 bg-gray-50 rounded-lg border">
          <div className="text-sm leading-relaxed">
            {displayedText.length === 1 && !fullSentences.length && !realtimeText ? (
              <span className="text-gray-400">음성 인식 결과가 여기에 표시됩니다...</span>
            ) : (
              displayedText
            )}
          </div>
        </div>

        {/* 통계 */}
        {fullSentences.length > 0 && (
          <div className="text-xs text-gray-500 text-center">
            총 {fullSentences.length}개 문장 인식됨
          </div>
        )}
      </div>
    </div>
  );
} 