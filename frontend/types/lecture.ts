export interface Lecture {
  id: number;
  title: string;
  description: string;
  instructor_name: string;
  instructor_id: number;
  status: 'scheduled' | 'live' | 'ended';
  participant_count: number;
  max_participants: number;
  scheduled_start: string;
  created_at: string;
  updated_at?: string;
}

export interface LectureCreate {
  title: string;
  description: string;
  max_participants: number;
  scheduled_start: string;
}

export interface LectureUpdate {
  title?: string;
  description?: string;
  max_participants?: number;
  scheduled_start?: string;
  status?: 'scheduled' | 'live' | 'ended';
}

export interface LectureParticipant {
  id: number;
  lecture_id: number;
  student_id: number;
  student_name: string;
  joined_at: string;
  left_at?: string;
  is_active: boolean;
}

export interface ChatMessage {
  id: string;
  user_name: string;
  user_role: 'instructor' | 'student';
  message: string;
  timestamp: string;
  translated_message?: string;
  original_language?: string;
} 