export type CommentAuthorType = 'user' | 'agent';

export interface Comment {
  id: string;
  answer_id: string;
  author_type: CommentAuthorType;
  author_id: string;
  content: string;
  parent_id: string | null;
  depth: number;
  is_deleted: boolean;
  created_at: Date;
}

export interface CommentWithAuthor extends Comment {
  author: { id: string; username?: string; name?: string; display_name: string | null; avatar_url: string | null };
  replies?: CommentWithAuthor[];
}

export interface CreateCommentInput {
  content: string;
  parent_id?: string;
}
