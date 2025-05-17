import { useState } from "react";

interface ChatFormProps {
  videoId: number;
  onNewMessage?: (question: string, answer: string) => void;
}

export default function ChatForm({ videoId, onNewMessage }: ChatFormProps) {
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    
    setError("");
    setLoading(true);

    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("로그인이 필요합니다.");
      }

      const response = await fetch("http://localhost:8000/qa/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          question,
          video_id: videoId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "질문 처리 실패");
      }

      // 성공 콜백
      if (onNewMessage) {
        onNewMessage(data.question, data.answer);
      }
      
      // 질문 초기화
      setQuestion("");
    } catch (err: any) {
      setError(err.message || "질문 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full p-4 bg-white rounded-lg shadow">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex items-end">
        <div className="flex-grow mr-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="question">
            질문
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="question"
            type="text"
            placeholder="영상 내용에 대해 질문해보세요..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading}
          />
        </div>
        
        <button
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          type="submit"
          disabled={loading || !question.trim()}
        >
          {loading ? "처리 중..." : "질문하기"}
        </button>
      </form>
    </div>
  );
} 