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

describe('Answer routes', () => {
  // ---------------------------------------------------------------
  // POST /api/questions/:id/answers
  // ---------------------------------------------------------------

  test('POST /api/questions/:id/answers creates answer with agent auth (201)', async () => {
    const user = await createTestUser(pool);
    const agent = await createTestAgent(pool);
    const question = await createTestQuestion(pool, user.id);

    const res = await request(app)
      .post(`/api/questions/${question.id}/answers`)
      .set('X-Agent-Key', agent.apiKey)
      .send({
        content: 'This is a detailed answer to the question with helpful information.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.answer).toBeDefined();
    expect(res.body.data.answer.question_id).toBe(question.id);
    expect(res.body.data.answer.agent_id).toBe(agent.id);
    expect(res.body.data.answer.content).toBe(
      'This is a detailed answer to the question with helpful information.'
    );
  });

  test('POST /api/questions/:id/answers rejects without agent auth (401)', async () => {
    const user = await createTestUser(pool);
    const question = await createTestQuestion(pool, user.id);

    const res = await request(app)
      .post(`/api/questions/${question.id}/answers`)
      .send({
        content: 'An answer without auth.',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('POST /api/questions/:id/answers rejects duplicate answer (409)', async () => {
    const user = await createTestUser(pool);
    const agent = await createTestAgent(pool);
    const question = await createTestQuestion(pool, user.id);

    // First answer succeeds
    await request(app)
      .post(`/api/questions/${question.id}/answers`)
      .set('X-Agent-Key', agent.apiKey)
      .send({ content: 'First answer to this question from this agent.' });

    // Second answer from same agent should fail
    const res = await request(app)
      .post(`/api/questions/${question.id}/answers`)
      .set('X-Agent-Key', agent.apiKey)
      .send({ content: 'Second answer to this question from same agent.' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  test('POST /api/questions/:id/answers validates content', async () => {
    const user = await createTestUser(pool);
    const agent = await createTestAgent(pool);
    const question = await createTestQuestion(pool, user.id);

    const res = await request(app)
      .post(`/api/questions/${question.id}/answers`)
      .set('X-Agent-Key', agent.apiKey)
      .send({
        content: '',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // ---------------------------------------------------------------
  // GET /api/questions/:id/answers
  // ---------------------------------------------------------------

  test('GET /api/questions/:id/answers returns answers list', async () => {
    const user = await createTestUser(pool);
    const agent1 = await createTestAgent(pool, { name: 'agent-one' });
    const agent2 = await createTestAgent(pool, { name: 'agent-two' });
    const question = await createTestQuestion(pool, user.id);

    await createTestAnswer(pool, question.id, agent1.id, { content: 'Answer from agent one' });
    await createTestAnswer(pool, question.id, agent2.id, { content: 'Answer from agent two' });

    const res = await request(app).get(`/api/questions/${question.id}/answers`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.answers).toBeDefined();
    expect(Array.isArray(res.body.data.answers)).toBe(true);
    expect(res.body.data.answers.length).toBe(2);
  });

  test('GET /api/questions/:id/answers sorts by votes', async () => {
    const user = await createTestUser(pool);
    const agent1 = await createTestAgent(pool, { name: 'agent-low-vote' });
    const agent2 = await createTestAgent(pool, { name: 'agent-high-vote' });
    const question = await createTestQuestion(pool, user.id);

    const a1 = await createTestAnswer(pool, question.id, agent1.id, { content: 'Low score answer' });
    const a2 = await createTestAnswer(pool, question.id, agent2.id, { content: 'High score answer' });

    // Give a2 a higher score
    await pool.query('UPDATE answers SET score = 10 WHERE id = $1', [a2.id]);
    await pool.query('UPDATE answers SET score = 1 WHERE id = $1', [a1.id]);

    const res = await request(app).get(`/api/questions/${question.id}/answers?sort=votes`);

    expect(res.status).toBe(200);
    expect(res.body.data.answers.length).toBe(2);
    // Higher score first
    expect(res.body.data.answers[0].id).toBe(a2.id);
    expect(res.body.data.answers[1].id).toBe(a1.id);
  });

  test('GET /api/questions/:id/answers includes user_vote when authenticated', async () => {
    const user = await createTestUser(pool);
    const agent = await createTestAgent(pool);
    const question = await createTestQuestion(pool, user.id);
    const answer = await createTestAnswer(pool, question.id, agent.id);
    const token = createTestHumanToken(user.id);

    // Cast a vote
    await pool.query(
      'INSERT INTO votes (user_id, answer_id, value) VALUES ($1, $2, $3)',
      [user.id, answer.id, 1]
    );

    const res = await request(app)
      .get(`/api/questions/${question.id}/answers`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.answers.length).toBe(1);
    expect(res.body.data.answers[0].user_vote).toBe(1);
  });

  test('POST /api/questions/:id/answers increments question answer_count', async () => {
    const user = await createTestUser(pool);
    const agent = await createTestAgent(pool);
    const question = await createTestQuestion(pool, user.id);

    // Initially answer_count should be 0
    const before = await pool.query('SELECT answer_count FROM questions WHERE id = $1', [question.id]);
    expect(before.rows[0].answer_count).toBe(0);

    await request(app)
      .post(`/api/questions/${question.id}/answers`)
      .set('X-Agent-Key', agent.apiKey)
      .send({ content: 'A valid answer to increment the count.' });

    const after = await pool.query('SELECT answer_count FROM questions WHERE id = $1', [question.id]);
    expect(after.rows[0].answer_count).toBe(1);
  });
});
