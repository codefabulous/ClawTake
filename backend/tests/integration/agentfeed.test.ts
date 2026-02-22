import request from 'supertest';
import { createApp } from '../../src/app';
import { getTestPool, truncateAllTables, closeTestPool } from '../helpers/db';
import { createTestUser, createTestAgent, createTestQuestion, createTestAnswer, createTestTag } from '../helpers/fixtures';
import { createTestAgentHeader } from '../helpers/auth';
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

describe('Agent feed routes', () => {
  async function createQuestionWithTag(authorId: string, tagName: string) {
    const tag = await createTestTag(pool, tagName);
    const question = await createTestQuestion(pool, authorId);
    await pool.query(
      'INSERT INTO question_tags (question_id, tag_id) VALUES ($1, $2)',
      [question.id, tag.id]
    );
    return { question, tag };
  }

  // ---------------------------------------------------------------
  // GET /api/agents/me/feed
  // ---------------------------------------------------------------

  test('GET /api/agents/me/feed returns matching questions for agent with tags', async () => {
    const user = await createTestUser(pool);
    const agent = await createTestAgent(pool, { expertise_tags: ['python'] });

    const { question: pythonQ } = await createQuestionWithTag(user.id, 'python');
    await createQuestionWithTag(user.id, 'javascript');

    const res = await request(app)
      .get('/api/agents/me/feed')
      .set(createTestAgentHeader(agent.apiKey));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.questions).toBeDefined();
    expect(res.body.data.questions.length).toBe(1);
    expect(res.body.data.questions[0].id).toBe(pythonQ.id);
  });

  test('GET /api/agents/me/feed returns all unseen questions for agent without expertise tags', async () => {
    const user = await createTestUser(pool);
    const agent = await createTestAgent(pool, { expertise_tags: [] });

    await createQuestionWithTag(user.id, 'python');
    await createQuestionWithTag(user.id, 'javascript');
    await createQuestionWithTag(user.id, 'rust');

    const res = await request(app)
      .get('/api/agents/me/feed')
      .set(createTestAgentHeader(agent.apiKey));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.questions.length).toBe(3);
  });

  test('GET /api/agents/me/feed excludes already-acknowledged questions', async () => {
    const user = await createTestUser(pool);
    const agent = await createTestAgent(pool, { expertise_tags: ['python'] });

    const { question: q1 } = await createQuestionWithTag(user.id, 'python');
    const { question: q2 } = await createQuestionWithTag(user.id, 'python');

    // Mark q1 as seen
    await pool.query(
      'INSERT INTO agent_question_seen (agent_id, question_id) VALUES ($1, $2)',
      [agent.id, q1.id]
    );

    const res = await request(app)
      .get('/api/agents/me/feed')
      .set(createTestAgentHeader(agent.apiKey));

    expect(res.status).toBe(200);
    expect(res.body.data.questions.length).toBe(1);
    expect(res.body.data.questions[0].id).toBe(q2.id);
  });

  test('GET /api/agents/me/feed excludes questions agent has already answered', async () => {
    const user = await createTestUser(pool);
    const agent = await createTestAgent(pool, { expertise_tags: ['python'] });

    const { question: q1 } = await createQuestionWithTag(user.id, 'python');
    const { question: q2 } = await createQuestionWithTag(user.id, 'python');

    // Agent answers q1
    await createTestAnswer(pool, q1.id, agent.id);

    const res = await request(app)
      .get('/api/agents/me/feed')
      .set(createTestAgentHeader(agent.apiKey));

    expect(res.status).toBe(200);
    expect(res.body.data.questions.length).toBe(1);
    expect(res.body.data.questions[0].id).toBe(q2.id);
  });

  test('GET /api/agents/me/feed returns has_more correctly', async () => {
    const user = await createTestUser(pool);
    const agent = await createTestAgent(pool, { expertise_tags: [] });

    // Create 12 questions (default limit is 10, so has_more should be true)
    const sharedTag = await createTestTag(pool, 'general');
    for (let i = 0; i < 12; i++) {
      const q = await createTestQuestion(pool, user.id);
      await pool.query(
        'INSERT INTO question_tags (question_id, tag_id) VALUES ($1, $2)',
        [q.id, sharedTag.id]
      );
    }

    const res = await request(app)
      .get('/api/agents/me/feed')
      .set(createTestAgentHeader(agent.apiKey));

    expect(res.status).toBe(200);
    expect(res.body.data.questions.length).toBe(10);
    expect(res.body.data.has_more).toBe(true);

    // With a larger limit, has_more should be false
    const res2 = await request(app)
      .get('/api/agents/me/feed?limit=20')
      .set(createTestAgentHeader(agent.apiKey));

    expect(res2.status).toBe(200);
    expect(res2.body.data.questions.length).toBe(12);
    expect(res2.body.data.has_more).toBe(false);
  });

  test('GET /api/agents/me/feed rejects without agent API key (401)', async () => {
    const res = await request(app).get('/api/agents/me/feed');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('GET /api/agents/me/feed?limit=5 respects limit parameter', async () => {
    const user = await createTestUser(pool);
    const agent = await createTestAgent(pool, { expertise_tags: [] });

    const sharedTag = await createTestTag(pool, 'general');
    for (let i = 0; i < 8; i++) {
      const q = await createTestQuestion(pool, user.id);
      await pool.query(
        'INSERT INTO question_tags (question_id, tag_id) VALUES ($1, $2)',
        [q.id, sharedTag.id]
      );
    }

    const res = await request(app)
      .get('/api/agents/me/feed?limit=5')
      .set(createTestAgentHeader(agent.apiKey));

    expect(res.status).toBe(200);
    expect(res.body.data.questions.length).toBe(5);
    expect(res.body.data.has_more).toBe(true);
  });

  // ---------------------------------------------------------------
  // POST /api/agents/me/feed/ack
  // ---------------------------------------------------------------

  test('POST /api/agents/me/feed/ack marks questions as seen, then feed no longer returns them', async () => {
    const user = await createTestUser(pool);
    const agent = await createTestAgent(pool, { expertise_tags: ['python'] });

    const { question: q1 } = await createQuestionWithTag(user.id, 'python');
    const { question: q2 } = await createQuestionWithTag(user.id, 'python');

    // Acknowledge q1
    const ackRes = await request(app)
      .post('/api/agents/me/feed/ack')
      .set(createTestAgentHeader(agent.apiKey))
      .send({ question_ids: [q1.id] });

    expect(ackRes.status).toBe(200);
    expect(ackRes.body.success).toBe(true);
    expect(ackRes.body.data.acknowledged).toBe(1);

    // Feed should only return q2 now
    const feedRes = await request(app)
      .get('/api/agents/me/feed')
      .set(createTestAgentHeader(agent.apiKey));

    expect(feedRes.status).toBe(200);
    expect(feedRes.body.data.questions.length).toBe(1);
    expect(feedRes.body.data.questions[0].id).toBe(q2.id);
  });

  test('POST /api/agents/me/feed/ack rejects empty question_ids array (400)', async () => {
    const agent = await createTestAgent(pool);

    const res = await request(app)
      .post('/api/agents/me/feed/ack')
      .set(createTestAgentHeader(agent.apiKey))
      .send({ question_ids: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('POST /api/agents/me/feed/ack rejects without agent API key (401)', async () => {
    const res = await request(app)
      .post('/api/agents/me/feed/ack')
      .send({ question_ids: ['00000000-0000-0000-0000-000000000000'] });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
