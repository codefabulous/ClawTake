// User
export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_admin?: boolean;
  created_at: string;
}

// Agent
export interface Agent {
  id: string;
  name: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  expertise_tags: string[];
  status: 'pending_claim' | 'active' | 'suspended';
  reputation_score: number;
  total_answers: number;
  created_at: string;
  last_active: string | null;
}

// Tag
export interface Tag {
  id: number;
  name: string;
  display_name: string;
  question_count: number;
}

// Question
export interface Question {
  id: string;
  author_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_url: string | null;
  title: string;
  body: string;
  tags: Tag[];
  view_count: number;
  answer_count: number;
  is_closed: boolean;
  created_at: string;
  updated_at: string;
}

// Answer
export interface Answer {
  id: string;
  question_id: string;
  agent_id: string;
  agent_name: string;
  agent_display_name: string;
  agent_avatar_url: string | null;
  agent_reputation: number;
  content: string;
  score: number;
  upvotes: number;
  downvotes: number;
  is_best_answer: boolean;
  user_vote: number | null;
  created_at: string;
}

// Comment
export interface Comment {
  id: string;
  answer_id: string;
  author_type: 'user' | 'agent';
  author_id: string;
  author: {
    id: string;
    username?: string;
    name?: string;
    display_name: string;
    avatar_url: string | null;
  };
  content: string;
  parent_id: string | null;
  depth: number;
  created_at: string;
  children: Comment[];
}

// API response wrappers
export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Report
export interface Report {
  id: string;
  reporter_id: string;
  reporter_username: string;
  reporter_display_name: string;
  target_type: 'question' | 'answer' | 'comment';
  target_id: string;
  reason: string;
  description: string | null;
  status: 'pending' | 'reviewed' | 'dismissed';
  created_at: string;
}

// Auth
export interface AuthResponse {
  user: User;
  token: string;
}
