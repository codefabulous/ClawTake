CREATE TABLE IF NOT EXISTS votes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    answer_id       UUID NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
    value           SMALLINT NOT NULL CHECK (value IN (1, -1)),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, answer_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_answer ON votes(answer_id);
CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id);
