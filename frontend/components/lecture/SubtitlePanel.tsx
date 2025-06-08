'use client';

import { useState, useEffect, useRef } from 'react';
import { Button, Typography, Badge, Tooltip, Card, Switch } from 'antd';
import { 
  TranslationOutlined,
  DownloadOutlined,
  ClearOutlined,
  SoundOutlined,
  EyeOutlined,
  CloseOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

interface SubtitleEntry {
  id: string;
  text: string;
  timestamp: Date;
}

interface SubtitlePanelProps {
  language: string;
  onLanguageChange: (language: string) => void;
  subtitles: SubtitleEntry[];
  showInFooter?: boolean;
  currentTranscript?: string; // 현재 진행 중인 음성 인식 텍스트
}

export function SubtitlePanel({ 
  language, 
  onLanguageChange, 
  subtitles, 
  showInFooter = false,
  currentTranscript = ''
}: SubtitlePanelProps) {
  const [isListening, setIsListening] = useState(true);
  const subtitlesEndRef = useRef<HTMLDivElement>(null);
  const [showTranslation, setShowTranslation] = useState(false); // 번역 기능 비활성화
  const [autoScroll, setAutoScroll] = useState(true);

  // props로 받은 subtitles를 직접 사용
  const subtitlesList = subtitles;

  // Auto scroll to bottom when new subtitles are added
  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [subtitles, autoScroll]);

  const scrollToBottom = () => {
    subtitlesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const handleExportSubtitles = () => {
    const srtContent = subtitlesList.map((subtitle, index) => {
      const start = formatTime(subtitle.timestamp);
      const end = formatTime(new Date(subtitle.timestamp.getTime() + 3000));
      return `${index + 1}\n${start} --> ${end}\n${subtitle.text}\n`;
    }).join('\n');

    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtitles_${Date.now()}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SubtitleItem = ({ subtitle }: { subtitle: SubtitleEntry }) => (
    <div className="group bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-all">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
        <Text className="text-white/60 text-xs font-medium">
          {formatTime(subtitle.timestamp)}
        </Text>
        <div className="px-2 py-0.5 rounded-full text-xs font-medium text-green-400 bg-green-400/10">
          한국어
        </div>
      </div>
      
      <div className="bg-blue-500/20 rounded-lg p-3 border border-blue-500/30">
        <Text className="text-white leading-relaxed font-medium text-base">
          {subtitle.text}
        </Text>
      </div>
    </div>
  );

  // 최근 자막 (하단 표시용)
  const recentSubtitle = subtitlesList[subtitlesList.length - 1];
  const displayText = currentTranscript || recentSubtitle?.text || '';

  if (showInFooter) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex-1">
          {displayText && (
            <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 max-w-4xl mx-auto">
              <div className="text-white text-center">
                <div className={`text-lg leading-relaxed ${currentTranscript ? 'text-blue-300 animate-pulse' : ''}`}>
                  {displayText}
                </div>
                {currentTranscript && (
                  <div className="text-xs text-white/60 mt-1">
                    음성 인식 중...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${
              currentTranscript ? 'bg-red-400 animate-pulse' : isListening ? 'bg-green-400' : 'bg-gray-400'
            }`} />
            <Text className="text-white/80 text-xs">
              {currentTranscript ? '인식 중' : isListening ? '대기 중' : '일시정지'}
            </Text>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full grid grid-rows-[auto_1fr] bg-black/20 backdrop-blur-sm">
      {/* 헤더 */}
      <div className="p-3 border-b border-white/10 bg-gradient-to-r from-purple-600/30 to-blue-600/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TranslationOutlined className="text-purple-400" />
            <Text className="font-semibold text-white text-sm">실시간 자막</Text>
            <Badge 
              count={subtitlesList.length} 
              showZero 
              style={{ backgroundColor: '#9333ea', fontSize: '10px' }}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${
                currentTranscript ? 'bg-red-400 animate-pulse' : isListening ? 'bg-green-400' : 'bg-gray-400'
              }`} />
              <Text className="text-white/80 text-xs">
                {currentTranscript ? '음성 인식 중' : isListening ? '대기 중' : '일시정지'}
              </Text>
            </div>
            
            <div className="flex items-center gap-1 bg-white/10 backdrop-blur-sm rounded-lg p-1">
              <Tooltip title="자막 다운로드">
                <Button
                  type="text"
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={handleExportSubtitles}
                  className="text-white/60 hover:text-white hover:bg-white/10 border-0"
                />
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      {/* 자막 목록 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">
        {subtitlesList.length === 0 && !currentTranscript ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <TranslationOutlined className="text-4xl text-white/30 mb-4" />
            <Text className="text-white/60 text-sm">
              자막이 여기에 표시됩니다
            </Text>
            <Text className="text-white/40 text-xs mt-2">
              STT를 시작하면 실시간으로 음성이 자막으로 변환됩니다
            </Text>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {/* 현재 진행 중인 음성 인식 텍스트 */}
            {currentTranscript && (
              <div className="bg-yellow-500/20 backdrop-blur-sm rounded-lg p-4 border border-yellow-500/30 animate-pulse">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping" />
                  <Text className="text-yellow-300 text-xs font-medium">
                    실시간 인식 중...
                  </Text>
                </div>
                <Text className="text-white leading-relaxed font-medium text-base">
                  {currentTranscript}
                </Text>
              </div>
            )}
            
            {/* 확정된 자막들 */}
            {subtitlesList.slice(-10).map((subtitle) => (
              <SubtitleItem key={subtitle.id} subtitle={subtitle} />
            ))}
            <div ref={subtitlesEndRef} />
          </div>
        )}
      </div>
    </div>
  );
} 