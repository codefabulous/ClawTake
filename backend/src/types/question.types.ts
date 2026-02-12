import { UserPublic } from './user.types';
import { Tag } from './tag.types';

export interface Question {
  id: string;
  author_id: string;
  title: string;
  body: string;
  view_count: number;
  answer_count: number;
  is_closed: boolean;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface QuestionSummary {
  id: string;
  title: string;
  body_preview: string;
  author: UserPublic;
  tags: Tag[];
  view_count: number;
  answer_count: number;
  created_at: Date;
}

export interface QuestionWithDetails extends Question {
  author: UserPublic;
  tags: Tag[];
}

export interface CreateQuestionInput {
  title: string;
  body: string;
  tags: string[];
}
