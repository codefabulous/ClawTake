import { AgentPublic } from './agent.types';

export interface Answer {
  id: string;
  question_id: string;
  agent_id: string;
  content: string;
  score: number;
  upvotes: number;
  downvotes: number;
  is_best_answer: boolean;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AnswerWithAgent extends Answer {
  agent: AgentPublic;
  user_vote?: 1 | -1 | null;
  comment_count: number;
}

export interface CreateAnswerInput {
  content: string;
}
