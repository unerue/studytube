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
  originalText: string;
  translatedText: string;
  timestamp: Date;
  confidence: number;
  speaker?: string;
}

interface SubtitlePanelProps {
  language: string;
  onLanguageChange: (language: string) => void;
  subtitles: SubtitleEntry[];
  showInFooter?: boolean;
}

export function SubtitlePanel({ language, onLanguageChange, subtitles, showInFooter = false }: SubtitlePanelProps) {
  const [subtitlesList, setSubtitlesList] = useState<SubtitleEntry[]>([]);
  const [isListening, setIsListening] = useState(true);
  const subtitlesEndRef = useRef<HTMLDivElement>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // Mock subtitle data generation
  useEffect(() => {
    if (!isListening) return;

    const mockSubtitles: SubtitleEntry[] = [
      {
        id: '1',
        originalText: '안녕하세요 여러분, 오늘은 AI와 머신러닝에 대해 공부해보겠습니다.',
        translatedText: 'Hello everyone, today we will study AI and machine learning.',
        timestamp: new Date(Date.now() - 15000),
        confidence: 0.95
      },
      {
        id: '2',
        originalText: '먼저 인공지능의 기본 개념부터 설명드리겠습니다.',
        translatedText: 'First, I will explain the basic concepts of artificial intelligence.',
        timestamp: new Date(Date.now() - 12000),
        confidence: 0.92
      },
      {
        id: '3',
        originalText: '질문이 있으시면 언제든지 채팅창에 써주세요.',
        translatedText: 'If you have any questions, please write them in the chat at any time.',
        timestamp: new Date(Date.now() - 8000),
        confidence: 0.88
      }
    ];

    setSubtitlesList(mockSubtitles);

    // Simulate real-time subtitles
    const interval = setInterval(() => {
      const newSubtitle: SubtitleEntry = {
        id: Date.now().toString(),
        originalText: '이것은 실시간 자막의 예시입니다.',
        translatedText: 'This is an example of real-time subtitles.',
        timestamp: new Date(),
        confidence: 0.85 + Math.random() * 0.15
      };

      setSubtitlesList(prev => [...prev, newSubtitle]);
    }, 5000);

    return () => clearInterval(interval);
  }, [isListening]);

  // Auto scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [subtitlesList]);

  const scrollToBottom = () => {
    subtitlesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-400';
    if (confidence >= 0.8) return 'text-yellow-400';
    return 'text-red-400';
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
      return `${index + 1}\n${start} --> ${end}\n${subtitle.originalText}\n${subtitle.translatedText}\n`;
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
        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
        <Text className="text-white/60 text-xs font-medium">
          {formatTime(subtitle.timestamp)}
        </Text>
        <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${getConfidenceColor(subtitle.confidence)} bg-current/10`}>
          {Math.round(subtitle.confidence * 100)}% 정확도
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="bg-blue-500/20 rounded-lg p-3 border border-blue-500/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-blue-300 text-xs font-bold">[원문]</span>
            <span className="text-white/60 text-xs">한국어</span>
          </div>
          <Text className="text-white leading-relaxed font-medium text-base">
            {subtitle.originalText}
          </Text>
        </div>
        
        <div className="bg-green-500/20 rounded-lg p-3 border border-green-500/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-300 text-xs font-bold">[번역]</span>
            <span className="text-white/60 text-xs">English</span>
          </div>
          <Text className="text-white leading-relaxed font-medium text-base">
            {subtitle.translatedText}
          </Text>
        </div>
      </div>
    </div>
  );

  // 최근 자막 (하단 표시용)
  const recentSubtitle = subtitlesList[subtitlesList.length - 1];

  if (showInFooter) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex-1">
          {recentSubtitle && (
            <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 max-w-4xl mx-auto">
              <div className="text-white text-center">
                <div className="text-lg leading-relaxed">
                  {recentSubtitle.originalText}
                </div>
                {showTranslation && recentSubtitle.translatedText && (
                  <div className="text-blue-300 text-sm mt-1">
                    {recentSubtitle.translatedText}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          <Switch
            checked={showTranslation}
            onChange={setShowTranslation}
            checkedChildren={<TranslationOutlined />}
            unCheckedChildren={<TranslationOutlined />}
            size="small"
          />
          <span className="text-xs text-gray-300">번역</span>
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
                isListening ? 'bg-red-400 animate-pulse' : 'bg-gray-400'
              }`} />
              <Text className="text-white/80 text-xs">
                {isListening ? '수신 중' : '일시정지'}
              </Text>
            </div>
            
            <div className="flex items-center gap-1 bg-white/10 backdrop-blur-sm rounded-lg p-1">
              <Tooltip title="자막 목록 지우기">
                <Button
                  type="text"
                  size="small"
                  icon={<ClearOutlined />}
                  onClick={() => setSubtitlesList([])}
                  className="text-white/60 hover:text-white hover:bg-white/10 border-0"
                />
              </Tooltip>
              
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
        {subtitlesList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <TranslationOutlined className="text-4xl text-white/30 mb-4" />
            <Text className="text-white/60 text-sm">
              {isListening ? '음성을 기다리고 있습니다...' : '자막 수신이 일시정지되었습니다'}
            </Text>
          </div>
        ) : (
          <div className="p-3 space-y-4">
            {subtitlesList.map(subtitle => (
              <SubtitleItem key={subtitle.id} subtitle={subtitle} />
            ))}
          </div>
        )}
        <div ref={subtitlesEndRef} />
      </div>
    </div>
  );
} 