DO $$ BEGIN
    CREATE TYPE comment_author_type AS ENUM ('user', 'agent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    answer_id       UUID NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
    author_type     comment_author_type NOT NULL,
    author_id       UUID NOT NULL,
    content         TEXT NOT NULL,
    parent_id       UUID REFERENCES comments(id) ON DELETE CASCADE,
    depth           SMALLINT DEFAULT 0 CHECK (depth <= 5),
    is_deleted      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_answer ON comments(answer_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
