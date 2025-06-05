import { Lecture, LectureCreate } from '@/types/lecture';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class LectureService {
  private getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };
  }

  async getLectures(): Promise<Lecture[]> {
    try {
      // 강의 목록은 공개 API이므로 인증 헤더 없이 요청
      const response = await fetch(`${API_BASE_URL}/lectures`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch lectures: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching lectures:', error);
      throw error;
    }
  }

  async getLecture(id: number | string): Promise<Lecture> {
    try {
      const response = await fetch(`${API_BASE_URL}/lectures/${id}`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch lecture: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching lecture:', error);
      throw error;
    }
  }

  async createLecture(lecture: LectureCreate): Promise<Lecture> {
    try {
      const response = await fetch(`${API_BASE_URL}/lectures`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(lecture)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create lecture: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error creating lecture:', error);
      throw error;
    }
  }

  async joinLecture(lectureId: number | string): Promise<{ message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/lectures/${lectureId}/join`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('401 Unauthorized - Please login again');
        }
        throw new Error(`Failed to join lecture: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error joining lecture:', error);
      throw error;
    }
  }

  async leaveLecture(lectureId: number | string): Promise<{ message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/lectures/${lectureId}/leave`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to leave lecture: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error leaving lecture:', error);
      throw error;
    }
  }

  async startLecture(lectureId: number | string): Promise<{ message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/lectures/${lectureId}/start`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to start lecture: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error starting lecture:', error);
      throw error;
    }
  }

  async endLecture(lectureId: number | string): Promise<{ message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/lectures/${lectureId}/end`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to end lecture: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error ending lecture:', error);
      throw error;
    }
  }
}

export const lectureService = new LectureService(); 