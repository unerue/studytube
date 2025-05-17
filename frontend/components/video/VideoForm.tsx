'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/AuthContext";

interface VideoFormProps {
  onSuccess?: (videoId: number) => void;
}

export default function VideoForm({ onSuccess }: VideoFormProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { isLoggedIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 간단한 유효성 검사
      if (!url.includes("youtube.com") && !url.includes("youtu.be")) {
        throw new Error("유효한 YouTube URL을 입력해주세요.");
      }

      if (!isLoggedIn) {
        throw new Error("로그인이 필요합니다.");
      }

      const token = localStorage.getItem("access_token");
      
      const response = await fetch("http://localhost:8000/videos/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          url
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "영상 추가 실패");
      }

      // 성공 콜백 또는 리다이렉트
      if (onSuccess) {
        onSuccess(data.id);
      } else {
        router.push(`/study/${data.id}`);
      }
    } catch (err: any) {
      setError(err.message || "영상 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center text-blue-700">유튜브 영상 추가</h2>
      
      <p className="mb-4 text-gray-600">학습하고 싶은 YouTube 영상의 URL을 입력하세요.</p>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="url">
            YouTube URL
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="url"
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </div>
        
        <div className="flex items-center">
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded focus:outline-none focus:shadow-outline"
            type="submit"
            disabled={loading}
          >
            {loading ? "처리 중..." : "영상 분석하기"}
          </button>
          <p className="ml-4 text-gray-500 text-sm">AI가 영상을 분석하고 요약할 예정입니다.</p>
        </div>
      </form>
    </div>
  );
} 