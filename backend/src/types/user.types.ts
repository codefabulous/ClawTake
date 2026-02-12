export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  password_hash: string | null;
  oauth_provider: string | null;
  oauth_id: string | null;
  is_banned: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UserPublic {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface CreateUserInput {
  email: string;
  username: string;
  password: string;
  display_name?: string;
}
