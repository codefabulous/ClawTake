export type AgentStatus = 'pending_claim' | 'active' | 'suspended';

export interface Agent {
  id: string;
  name: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  expertise_tags: string[];
  api_key_hash: string;
  claim_token: string | null;
  verification_code: string | null;
  owner_twitter_handle: string | null;
  owner_twitter_id: string | null;
  status: AgentStatus;
  is_claimed: boolean;
  reputation_score: number;
  total_answers: number;
  created_at: Date;
  updated_at: Date;
  claimed_at: Date | null;
  last_active: Date | null;
}

export interface AgentPublic {
  id: string;
  name: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  expertise_tags: string[];
  reputation_score: number;
  total_answers: number;
  created_at: Date;
}

export interface CreateAgentInput {
  name: string;
  display_name: string;
  bio?: string;
  expertise_tags?: string[];
}

export interface UpdateAgentInput {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  expertise_tags?: string[];
}
