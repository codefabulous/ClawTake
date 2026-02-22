import { Pool } from 'pg';
import { v4 as uuid } from 'uuid';
import { hashPassword } from '../../src/utils/hash';
import { generateApiKey, generateClaimToken, generateVerificationCode } from '../../src/utils/hash';

export async function createTestUser(pool: Pool, overrides?: Record<string, any>) {
  const password = overrides?.password || 'testpass123';
  const passwordHash = await hashPassword(password);
  const defaults = {
    email: `user-${uuid().slice(0, 8)}@test.com`,
    username: `user_${uuid().slice(0, 8)}`,
    display_name: 'Test User',
    password_hash: passwordHash,
  };
  const data = { ...defaults, ...overrides, password_hash: overrides?.password_hash || passwordHash };

  const { rows } = await pool.query(
    `INSERT INTO users (email, username, display_name, password_hash)
     VALUES (LOWER($1), $2, $3, $4) RETURNING *`,
    [data.email, data.username, data.display_name, data.password_hash]
  );

  return { ...rows[0], password };
}

export async function createTestAgent(pool: Pool, overrides?: Record<string, any>) {
  const apiKey = generateApiKey();
  const defaults = {
    name: `agent-${uuid().slice(0, 8)}`,
    display_name: 'Test Agent',
    bio: 'A test agent',
    expertise_tags: ['testing'],
    status: 'active',
    is_claimed: true,
  };
  const data = { ...defaults, ...overrides };

  const { rows } = await pool.query(
    `INSERT INTO agents (name, display_name, bio, expertise_tags, api_key_hash, claim_token, verification_code, status, is_claimed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      data.name,
      data.display_name,
      data.bio,
      data.expertise_tags,
      apiKey.hash,
      generateClaimToken(),
      generateVerificationCode(),
      data.status,
      data.is_claimed,
    ]
  );

  return { ...rows[0], apiKey: apiKey.raw };
}

export async function createTestQuestion(pool: Pool, authorId: string, overrides?: Record<string, any>) {
  const defaults = {
    title: `Test Question ${uuid().slice(0, 8)}`,
    body: 'This is a test question body with enough content to pass validation.',
  };
  const data = { ...defaults, ...overrides };

  const { rows } = await pool.query(
    `INSERT INTO questions (author_id, title, body)
     VALUES ($1, $2, $3) RETURNING *`,
    [authorId, data.title, data.body]
  );

  return rows[0];
}

export async function createTestAnswer(pool: Pool, questionId: string, agentId: string, overrides?: Record<string, any>) {
  const defaults = {
    content: 'This is a test answer with enough content.',
  };
  const data = { ...defaults, ...overrides };

  const { rows } = await pool.query(
    `INSERT INTO answers (question_id, agent_id, content)
     VALUES ($1, $2, $3) RETURNING *`,
    [questionId, agentId, data.content]
  );

  return rows[0];
}

export async function createTestTag(pool: Pool, name: string, displayName?: string) {
  const { rows } = await pool.query(
    `INSERT INTO tags (name, display_name) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING *`,
    [name, displayName || name.charAt(0).toUpperCase() + name.slice(1)]
  );
  return rows[0];
}

export async function createTestAdminUser(pool: Pool, overrides?: Record<string, any>) {
  const user = await createTestUser(pool, overrides);
  await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [user.id]);
  return { ...user, is_admin: true };
}

export async function createTestReport(pool: Pool, data: {
  reporter_id: string;
  target_type: 'question' | 'answer' | 'comment';
  target_id: string;
  reason?: string;
}) {
  const { rows } = await pool.query(
    `INSERT INTO reports (reporter_id, target_type, target_id, reason)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.reporter_id, data.target_type, data.target_id, data.reason || 'spam']
  );
  return rows[0];
}

export async function createTestComment(pool: Pool, answerId: string, authorType: 'user' | 'agent', authorId: string) {
  const { rows } = await pool.query(
    `INSERT INTO comments (answer_id, author_type, author_id, content)
     VALUES ($1, $2, $3, 'Test comment content') RETURNING *`,
    [answerId, authorType, authorId]
  );
  return rows[0];
}
