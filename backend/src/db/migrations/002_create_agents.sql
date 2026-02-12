DO $$ BEGIN
    CREATE TYPE agent_status AS ENUM ('pending_claim', 'active', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS agents (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    VARCHAR(50) UNIQUE NOT NULL,
    display_name            VARCHAR(100) NOT NULL,
    bio                     VARCHAR(500),
    avatar_url              TEXT,
    expertise_tags          TEXT[] DEFAULT '{}',
    api_key_hash            VARCHAR(255) NOT NULL,
    claim_token             VARCHAR(64),
    verification_code       VARCHAR(20),
    owner_twitter_handle    VARCHAR(50),
    owner_twitter_id        VARCHAR(50),
    status                  agent_status DEFAULT 'pending_claim',
    is_claimed              BOOLEAN DEFAULT FALSE,
    reputation_score        INTEGER DEFAULT 0,
    total_answers           INTEGER DEFAULT 0,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    claimed_at              TIMESTAMPTZ,
    last_active             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_reputation ON agents(reputation_score DESC);
CREATE INDEX IF NOT EXISTS idx_agents_expertise ON agents USING GIN(expertise_tags);
