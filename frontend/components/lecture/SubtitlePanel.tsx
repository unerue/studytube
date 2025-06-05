'use client';

import { useState, useEffect, useRef } from 'react';
import { Button, Typography } from 'antd';
import { 
  TranslationOutlined,
  DownloadOutlined,
  ClearOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

interface SubtitleEntry {
  id: string;
  originalText: string;
  translatedText: string;
  timestamp: Date;
  confidence: number;
}

interface SubtitlePanelProps {
  language: string;
  onLanguageChange: (language: string) => void;
}

export function SubtitlePanel({ language, onLanguageChange }: SubtitlePanelProps) {
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
  const [isListening, setIsListening] = useState(true);
  const subtitlesEndRef = useRef<HTMLDivElement>(null);

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

    setSubtitles(mockSubtitles);

    // Simulate real-time subtitles
    const interval = setInterval(() => {
      const newSubtitle: SubtitleEntry = {
        id: Date.now().toString(),
        originalText: '이것은 실시간 자막의 예시입니다.',
        translatedText: 'This is an example of real-time subtitles.',
        timestamp: new Date(),
        confidence: 0.85 + Math.random() * 0.15
      };

      setSubtitles(prev => [...prev, newSubtitle]);
    }, 5000);

    return () => clearInterval(interval);
  }, [isListening]);

  // Auto scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [subtitles]);

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
    const srtContent = subtitles.map((subtitle, index) => {
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
    <div 
      className="p-4 border-b border-gray-700 hover:bg-gray-700 hover:bg-opacity-30"
      style={{ fontSize: '28px' }}
    >
      <div className="text-white mb-3 leading-relaxed font-medium">
        <span className="text-blue-400 text-lg mr-3">[원문]</span>
        {subtitle.originalText}
      </div>
      
      <div className="text-gray-300 leading-relaxed font-medium">
        <span className="text-green-400 text-lg mr-3">[번역]</span>
        {subtitle.translatedText}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* 간소화된 자막 헤더 */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Title level={5} className="text-white m-0">
              실시간 자막
            </Title>
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
              <Text className="text-gray-400 text-sm">
                {isListening ? '수신 중' : '일시정지'}
              </Text>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              type="text"
              size="small"
              icon={<ClearOutlined />}
              onClick={() => setSubtitles([])}
              className="text-gray-400 hover:text-white"
            />
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={handleExportSubtitles}
              className="text-gray-400 hover:text-white"
            />
          </div>
        </div>
      </div>

      {/* 자막 목록 - 가독성 향상을 위해 큰 폰트로 */}
      <div className="flex-1 overflow-y-auto">
        {subtitles.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <TranslationOutlined className="text-6xl text-gray-500 mb-4" />
              <Text className="text-gray-400 text-xl">
                {isListening ? '음성을 기다리고 있습니다...' : '자막 수신이 일시정지되었습니다'}
              </Text>
            </div>
          </div>
        ) : (
          <div>
            {subtitles.map(subtitle => (
              <SubtitleItem key={subtitle.id} subtitle={subtitle} />
            ))}
            <div ref={subtitlesEndRef} />
          </div>
        )}
      </div>
    </div>
  );
} 