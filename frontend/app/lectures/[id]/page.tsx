'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, Button, Select, Avatar, Badge, Tooltip, message, Drawer, Slider } from 'antd';
import { 
  MicrophoneOutlined, 
  VideoCameraOutlined, 
  AudioOutlined,
  SettingOutlined,
  UserOutlined,
  FullscreenOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { useParams, useRouter } from 'next/navigation';
import PPTViewer from '@/components/PPTViewer';

const { Option } = Select;

interface Participant {
  id: number;
  name: string;
  role: 'instructor' | 'student';
  avatar?: string;
  isOnline: boolean;
  preferredLanguage: string;
}

interface Subtitle {
  id: number;
  originalText: string;
  translatedText: string;
  timestamp: Date;
  language: string;
}

export default function LectureRoomPage() {
  const params = useParams();
  const router = useRouter();
  const lectureId = params.id as string;
  
  // 상태 관리
  const [lecture, setLecture] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState('ko');
  const [currentSlide, setCurrentSlide] = useState(1);
  const [totalSlides, setTotalSlides] = useState(5);
  const [showParticipants, setShowParticipants] = useState(false);
  const [volume, setVolume] = useState(80);
  const [userRole, setUserRole] = useState<'instructor' | 'student'>('student');
  
  // 음성 인식 관련
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  useEffect(() => {
    // 임시 강의 데이터
    setLecture({
      id: lectureId,
      title: "차량용 신호등 인식 AI 개발",
      instructor: "강경수 교수",
      status: "live"
    });
    
    // 임시 참여자 데이터
    setParticipants([
      { id: 1, name: "강경수 교수", role: "instructor", isOnline: true, preferredLanguage: "ko" },
      { id: 2, name: "김민수", role: "student", isOnline: true, preferredLanguage: "en" },
      { id: 3, name: "田中さん", role: "student", isOnline: true, preferredLanguage: "ja" },
      { id: 4, name: "李小明", role: "student", isOnline: true, preferredLanguage: "zh" },
    ]);
    
    // URL 파라미터 또는 사용자 설정에 따라 역할 결정
    const urlRole = new URLSearchParams(window.location.search).get('role');
    if (urlRole === 'instructor') {
      setUserRole('instructor');
    }
    
    // 음성 인식 초기화 (Web Speech API)
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ko-KR';
      
      recognition.onresult = (event: any) => {
        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal) {
          const originalText = lastResult[0].transcript;
          // 실시간 번역 시뮬레이션
          translateAndAddSubtitle(originalText);
        }
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    }

    // 데모용 자동 자막 시뮬레이션
    const demoSubtitles = [
      "안녕하세요, 오늘은 차량용 신호등 인식 AI에 대해 알아보겠습니다.",
      "딥러닝 기술을 활용하여 실시간으로 신호등을 인식하는 시스템입니다.",
      "YOLO 모델을 사용하여 높은 정확도를 달성했습니다.",
      "실험 결과 mAP 95.2%의 성능을 보였습니다."
    ];

    let subtitleIndex = 0;
    const subtitleInterval = setInterval(() => {
      if (subtitleIndex < demoSubtitles.length) {
        translateAndAddSubtitle(demoSubtitles[subtitleIndex]);
        subtitleIndex++;
      } else {
        clearInterval(subtitleInterval);
      }
    }, 10000); // 10초마다 새 자막

    return () => clearInterval(subtitleInterval);
  }, [lectureId]);

  const translateAndAddSubtitle = async (originalText: string) => {
    // 실제로는 번역 API 호출
    const translations: { [key: string]: string } = {
      'ko': originalText,
      'en': await simulateTranslation(originalText, 'en'),
      'ja': await simulateTranslation(originalText, 'ja'),
      'zh': await simulateTranslation(originalText, 'zh'),
      'es': await simulateTranslation(originalText, 'es'),
      'fr': await simulateTranslation(originalText, 'fr')
    };
    
    const newSubtitle: Subtitle = {
      id: Date.now(),
      originalText,
      translatedText: translations[selectedLanguage] || originalText,
      timestamp: new Date(),
      language: selectedLanguage
    };
    
    setSubtitles(prev => [...prev.slice(-4), newSubtitle]); // 최근 5개만 유지
  };

  const simulateTranslation = async (text: string, targetLang: string): Promise<string> => {
    // 실제로는 Google Translate API 등을 사용
    const translations: { [key: string]: { [key: string]: string } } = {
      'en': {
        '안녕하세요, 오늘은 차량용 신호등 인식 AI에 대해 알아보겠습니다.': 'Hello, today we will learn about vehicle traffic light recognition AI.',
        '딥러닝 기술을 활용하여 실시간으로 신호등을 인식하는 시스템입니다.': 'This is a system that recognizes traffic lights in real time using deep learning technology.',
        'YOLO 모델을 사용하여 높은 정확도를 달성했습니다.': 'We achieved high accuracy using the YOLO model.',
        '실험 결과 mAP 95.2%의 성능을 보였습니다.': 'The experimental results showed a performance of 95.2% mAP.'
      },
      'ja': {
        '안녕하세요, 오늘은 차량용 신호등 인식 AI에 대해 알아보겠습니다.': 'こんにちは、今日は車両用信号認識AIについて学びます。',
        '딥러닝 기술을 활용하여 실시간으로 신호등을 인식하는 시스템입니다.': 'ディープラーニング技術を活用してリアルタイムで信号を認識するシステムです。',
        'YOLO 모델을 사용하여 높은 정확도를 달성했습니다.': 'YOLOモデルを使用して高い精度を達成しました。',
        '실험 결과 mAP 95.2%의 성능을 보였습니다.': '実験結果はmAP 95.2%の性能を示しました。'
      },
      'zh': {
        '안녕하세요, 오늘은 차량용 신호등 인식 AI에 대해 알아보겠습니다.': '你好，今天我们将学习车辆交通信号灯识别AI。',
        '딥러닝 기술을 활용하여 실시간으로 신호등을 인식하는 시스템입니다.': '这是一个利用深度学习技术实时识别交通信号灯的系统。',
        'YOLO 모델을 사용하여 높은 정확도를 달성했습니다.': '我们使用YOLO模型实现了高精度。',
        '실험 결과 mAP 95.2%의 성능을 보였습니다.': '实验结果显示mAP达到95.2%的性能。'
      }
    };

    return translations[targetLang]?.[text] || `[${targetLang.toUpperCase()}] ${text}`;
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      message.error('음성 인식이 지원되지 않는 브라우저입니다.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      message.info('음성 인식을 중지했습니다.');
    } else {
      recognitionRef.current.start();
      setIsListening(true);
      message.success('음성 인식을 시작했습니다.');
    }
  };

  const handleSlideChange = (slideNumber: number) => {
    setCurrentSlide(slideNumber);
    message.info(`슬라이드 ${slideNumber}로 이동했습니다.`);
  };

  const languages = [
    { value: 'ko', label: '한국어', flag: '🇰🇷' },
    { value: 'en', label: 'English', flag: '🇺🇸' },
    { value: 'ja', label: '日本語', flag: '🇯🇵' },
    { value: 'zh', label: '中文', flag: '🇨🇳' },
    { value: 'es', label: 'Español', flag: '🇪🇸' },
    { value: 'fr', label: 'Français', flag: '🇫🇷' },
  ];

  if (!lecture) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      {/* 상단 바 */}
      <div className="bg-gray-800 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button 
            type="text" 
            icon={<CloseOutlined />} 
            onClick={() => router.push('/lectures')}
            className="text-white hover:bg-gray-700"
          />
          <div>
            <h1 className="text-lg font-semibold text-white">{lecture.title}</h1>
            <p className="text-sm text-gray-300">강사: {lecture.instructor}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Badge status="processing" text="LIVE" className="text-red-400" />
          <span className="text-sm text-gray-300">참여자: {participants.length}명</span>
          <Button
            type="text"
            icon={<UserOutlined />}
            onClick={() => setShowParticipants(true)}
            className="text-white hover:bg-gray-700"
          >
            참여자
          </Button>
          
          {/* 역할 표시 */}
          <Badge 
            status={userRole === 'instructor' ? 'success' : 'default'} 
            text={userRole === 'instructor' ? '강사' : '학생'}
            className="text-white"
          />
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex">
        {/* PPT 영역 */}
        <div className="flex-1 relative">
          <PPTViewer
            currentSlide={currentSlide}
            totalSlides={totalSlides}
            onSlideChange={handleSlideChange}
            isInstructor={userRole === 'instructor'}
          />
        </div>

        {/* 사이드바 (자막 + 컨트롤) */}
        <div className="w-80 bg-gray-800 flex flex-col">
          {/* 언어 선택 */}
          <div className="p-4 border-b border-gray-700">
            <Select
              value={selectedLanguage}
              onChange={setSelectedLanguage}
              className="w-full"
              size="large"
            >
              {languages.map(lang => (
                <Option key={lang.value} value={lang.value}>
                  {lang.flag} {lang.label}
                </Option>
              ))}
            </Select>
          </div>

          {/* 자막 영역 */}
          <div className="flex-1 p-4 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">실시간 자막</h3>
            <div className="space-y-3">
              {subtitles.map((subtitle) => (
                <div key={subtitle.id} className="bg-gray-700 p-3 rounded-lg animate-fadeIn">
                  <p className="text-sm text-white mb-1">{subtitle.translatedText}</p>
                  <p className="text-xs text-gray-400">
                    {subtitle.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              ))}
              {subtitles.length === 0 && (
                <div className="text-center text-gray-400 py-8">
                  <AudioOutlined className="text-2xl mb-2" />
                  <p>실시간 자막이 여기에 표시됩니다</p>
                  <p className="text-xs mt-2">데모가 자동으로 시작됩니다...</p>
                </div>
              )}
            </div>
          </div>

          {/* 컨트롤 패널 */}
          <div className="p-4 border-t border-gray-700 space-y-4">
            {/* 음성 컨트롤 (강사만) */}
            {userRole === 'instructor' && (
              <div className="flex justify-between items-center">
                <Button
                  type={isListening ? "primary" : "default"}
                  icon={<MicrophoneOutlined />}
                  onClick={toggleListening}
                  className={isListening ? "bg-red-500 border-red-500" : ""}
                >
                  {isListening ? "음성 인식 중..." : "음성 인식 시작"}
                </Button>
              </div>
            )}

            {/* 볼륨 조절 */}
            <div>
              <p className="text-sm text-gray-300 mb-2">볼륨</p>
              <Slider
                value={volume}
                onChange={setVolume}
                className="text-white"
                tooltip={{ formatter: (value) => `${value}%` }}
              />
            </div>

            {/* 기타 컨트롤 */}
            <div className="flex gap-2">
              <Button
                type="text"
                icon={<VideoCameraOutlined />}
                className="text-white hover:bg-gray-700"
                disabled
              />
              <Button
                type="text"
                icon={<SettingOutlined />}
                className="text-white hover:bg-gray-700"
              />
            </div>

            {/* 역할 전환 (테스트용) */}
            <div className="border-t border-gray-700 pt-4">
              <p className="text-xs text-gray-400 mb-2">테스트 모드:</p>
              <Button
                type="link"
                size="small"
                onClick={() => setUserRole(userRole === 'instructor' ? 'student' : 'instructor')}
                className="text-blue-400"
              >
                {userRole === 'instructor' ? '학생 모드로 전환' : '강사 모드로 전환'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 참여자 드로어 */}
      <Drawer
        title="참여자 목록"
        placement="right"
        onClose={() => setShowParticipants(false)}
        open={showParticipants}
        width={320}
      >
        <div className="space-y-3">
          {participants.map((participant) => (
            <div key={participant.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
              <Avatar icon={<UserOutlined />} />
              <div className="flex-1">
                <p className="font-medium">{participant.name}</p>
                <p className="text-sm text-gray-500">
                  {participant.role === 'instructor' ? '강사' : '학생'} • {participant.preferredLanguage.toUpperCase()}
                </p>
              </div>
              <Badge 
                status={participant.isOnline ? "success" : "default"} 
                text={participant.isOnline ? "온라인" : "오프라인"}
              />
            </div>
          ))}
        </div>
      </Drawer>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
} 