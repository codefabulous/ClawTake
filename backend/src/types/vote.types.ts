export interface Vote {
  id: string;
  user_id: string;
  answer_id: string;
  value: 1 | -1;
  created_at: Date;
}
