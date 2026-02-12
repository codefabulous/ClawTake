import request from 'supertest';
import { createApp } from '../../src/app';
import { getTestPool, truncateAllTables, closeTestPool } from '../helpers/db';
import { createTestUser, createTestAgent, createTestQuestion, createTestAnswer } from '../helpers/fixtures';
import { createTestHumanToken } from '../helpers/auth';
import Redis from 'ioredis';

let pool: any;
let redis: Redis;
let app: any;

beforeAll(() => {
  pool = getTestPool();
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  app = createApp({ pool, redis });
});

afterEach(async () => {
  await truncateAllTables();
  const keys = await redis.keys('ratelimit:*');
  if (keys.length > 0) await redis.del(...keys);
});

afterAll(async () => {
  await closeTestPool();
  await redis.quit();
});

describe('Vote routes', () => {
  /** Helper to set up a user, agent, question, answer, and token. */
  async function setupVoteScenario() {
    const user = await createTestUser(pool);
    const agent = await createTestAgent(pool);
    const question = await createTestQuestion(pool, user.id);
    const answer = await createTestAnswer(pool, question.id, agent.id);
    const token = createTestHumanToken(user.id);
    return { user, agent, question, answer, token };
  }

  // ---------------------------------------------------------------
  // POST /api/answers/:id/vote
  // ---------------------------------------------------------------

  test('POST /api/answers/:id/vote upvote returns new_score', async () => {
    const { answer, token } = await setupVoteScenario();

    const res = await request(app)
      .post(`/api/answers/${answer.id}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.new_score).toBe(1);
    expect(res.body.data.user_vote).toBe(1);
  });

  test('POST /api/answers/:id/vote downvote returns new_score', async () => {
    const { answer, token } = await setupVoteScenario();

    const res = await request(app)
      .post(`/api/answers/${answer.id}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: -1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.new_score).toBe(-1);
    expect(res.body.data.user_vote).toBe(-1);
  });

  test('POST /api/answers/:id/vote change vote updates score correctly', async () => {
    const { answer, token } = await setupVoteScenario();

    // First: upvote
    await request(app)
      .post(`/api/answers/${answer.id}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 1 });

    // Then: change to downvote
    const res = await request(app)
      .post(`/api/answers/${answer.id}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: -1 });

    expect(res.status).toBe(200);
    expect(res.body.data.new_score).toBe(-1);
    expect(res.body.data.user_vote).toBe(-1);
  });

  test('POST /api/answers/:id/vote same vote again is no-op', async () => {
    const { answer, token } = await setupVoteScenario();

    // First upvote
    const first = await request(app)
      .post(`/api/answers/${answer.id}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 1 });

    expect(first.body.data.new_score).toBe(1);

    // Same upvote again -- VoteService returns current state (no-op)
    const second = await request(app)
      .post(`/api/answers/${answer.id}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 1 });

    expect(second.status).toBe(200);
    expect(second.body.data.new_score).toBe(1);
    expect(second.body.data.user_vote).toBe(1);
  });

  // ---------------------------------------------------------------
  // DELETE /api/answers/:id/vote
  // ---------------------------------------------------------------

  test('DELETE /api/answers/:id/vote removes vote', async () => {
    const { answer, token } = await setupVoteScenario();

    // First upvote
    await request(app)
      .post(`/api/answers/${answer.id}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 1 });

    // Remove vote
    const res = await request(app)
      .delete(`/api/answers/${answer.id}/vote`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.new_score).toBe(0);
    expect(res.body.data.user_vote).toBeNull();
  });

  // ---------------------------------------------------------------
  // Auth & validation
  // ---------------------------------------------------------------

  test('POST /api/answers/:id/vote rejects without auth (401)', async () => {
    const { answer } = await setupVoteScenario();

    const res = await request(app)
      .post(`/api/answers/${answer.id}/vote`)
      .send({ value: 1 });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('POST /api/answers/:id/vote validates value (must be 1 or -1)', async () => {
    const { answer, token } = await setupVoteScenario();

    const res = await request(app)
      .post(`/api/answers/${answer.id}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 5 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // ---------------------------------------------------------------
  // Reputation
  // ---------------------------------------------------------------

  test('Voting affects agent reputation', async () => {
    const { agent, answer, token } = await setupVoteScenario();

    // Check initial reputation
    const before = await pool.query('SELECT reputation_score FROM agents WHERE id = $1', [agent.id]);
    const initialRep = before.rows[0].reputation_score;

    // Upvote should add +10 reputation
    await request(app)
      .post(`/api/answers/${answer.id}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 1 });

    const afterUp = await pool.query('SELECT reputation_score FROM agents WHERE id = $1', [agent.id]);
    expect(afterUp.rows[0].reputation_score).toBe(initialRep + 10);

    // Change to downvote: reverse upvote (-10) then apply downvote (-5) = net -15
    // But reputation floors at 0, so 0 + 10 - 10 - 5 = -5 → clamped to 0
    await request(app)
      .post(`/api/answers/${answer.id}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: -1 });

    const afterDown = await pool.query('SELECT reputation_score FROM agents WHERE id = $1', [agent.id]);
    expect(afterDown.rows[0].reputation_score).toBe(Math.max(initialRep - 5, 0));
  });
});
