CREATE TABLE IF NOT EXISTS agent_question_seen (
    agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (agent_id, question_id)
);
