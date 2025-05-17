'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ChatForm from '../../../components/video/ChatForm';

interface VideoData {
  id: number;
  title: string;
  url: string;
  thumbnail_url: string;
  description: string;
  summary: string;
  transcript: string;
}

interface Message {
  id: number;
  question: string;
  answer: string;
}

export default function StudyPage({ params }: { params: { id: string } }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  
  const videoId = parseInt(params.id);
  
  useEffect(() => {
    // 로그인 상태 확인
    const token = localStorage.getItem('access_token');
    setIsLoggedIn(!!token);
    
    if (!token) {
      router.push('/login');
      return;
    }
    
    // 영상 데이터 가져오기
    async function fetchVideoData() {
      try {
        const response = await fetch(`http://localhost:8000/videos/${videoId}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error("영상을 가져올 수 없습니다.");
        }
        
        const data = await response.json();
        setVideoData(data);
        
        // 이전 질문-답변 가져오기
        const qaResponse = await fetch(`http://localhost:8000/qa/my?video_id=${videoId}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        
        if (qaResponse.ok) {
          const qaData = await qaResponse.json();
          setMessages(qaData);
        }
      } catch (err: any) {
        setError(err.message || "오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }
    
    fetchVideoData();
  }, [videoId, router]);
  
  // 새 메시지 추가 핸들러
  const handleNewMessage = (question: string, answer: string) => {
    const newMessage = {
      id: Date.now(), // 임시 ID
      question,
      answer
    };
    
    setMessages(prev => [newMessage, ...prev]);
  };
  
  // 유튜브 URL에서 임베드 URL로 변환하는 함수
  const getEmbedUrl = (url: string) => {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/)?.[1];
    return `https://www.youtube.com/embed/${videoId}`;
  };
  
  if (!isLoggedIn) {
    return null;
  }
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl">로딩 중...</p>
      </div>
    );
  }
  
  if (error || !videoData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-xl text-red-600 mb-4">{error || "영상을 찾을 수 없습니다."}</p>
        <button
          onClick={() => router.push('/video')}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          다시 시도하기
        </button>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow py-4 px-6">
        <h1 className="text-2xl font-bold text-blue-700">{videoData.title}</h1>
      </header>
      
      <main className="container mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 영상 섹션 */}
        <div className="lg:col-span-2 bg-white p-4 rounded-lg shadow">
          <div className="aspect-video mb-4">
            <iframe
              src={getEmbedUrl(videoData.url)}
              className="w-full h-full"
              allowFullScreen
              title={videoData.title}
            ></iframe>
          </div>
          
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2">영상 설명</h2>
            <p className="text-gray-600 whitespace-pre-line">{videoData.description}</p>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold mb-2">AI 요약</h2>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-gray-800">{videoData.summary}</p>
            </div>
          </div>
        </div>
        
        {/* 채팅 섹션 */}
        <div className="bg-white p-4 rounded-lg shadow flex flex-col h-[calc(100vh-200px)]">
          <h2 className="text-xl font-semibold mb-4">질문하기</h2>
          
          <div className="flex-grow overflow-y-auto mb-4 space-y-4">
            {messages.length === 0 ? (
              <p className="text-gray-500 text-center py-8">영상에 관해 궁금한 점을 질문해 보세요.</p>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className="border-b pb-4">
                  <div className="font-semibold text-blue-700 mb-1">Q: {msg.question}</div>
                  <div className="pl-4 text-gray-700">A: {msg.answer}</div>
                </div>
              ))
            )}
          </div>
          
          <ChatForm videoId={videoId} onNewMessage={handleNewMessage} />
        </div>
      </main>
    </div>
  );
}