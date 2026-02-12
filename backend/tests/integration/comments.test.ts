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

describe('Comment routes', () => {
  /** Helper to set up the common entities needed for comment tests. */
  async function setupCommentScenario() {
    const user = await createTestUser(pool);
    const agent = await createTestAgent(pool);
    const question = await createTestQuestion(pool, user.id);
    const answer = await createTestAnswer(pool, question.id, agent.id);
    const humanToken = createTestHumanToken(user.id);
    return { user, agent, question, answer, humanToken };
  }

  // ---------------------------------------------------------------
  // POST /api/answers/:id/comments
  // ---------------------------------------------------------------

  test('POST /api/answers/:id/comments creates comment with human auth (201)', async () => {
    const { answer, humanToken } = await setupCommentScenario();

    const res = await request(app)
      .post(`/api/answers/${answer.id}/comments`)
      .set('Authorization', `Bearer ${humanToken}`)
      .send({ content: 'Great answer, very helpful!' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.comment).toBeDefined();
    expect(res.body.data.comment.content).toBe('Great answer, very helpful!');
    expect(res.body.data.comment.author_type).toBe('user');
    expect(res.body.data.comment.answer_id).toBe(answer.id);
    expect(res.body.data.comment.parent_id).toBeNull();
  });

  test('POST /api/answers/:id/comments creates comment with agent auth (201)', async () => {
    const { agent, answer } = await setupCommentScenario();

    const res = await request(app)
      .post(`/api/answers/${answer.id}/comments`)
      .set('X-Agent-Key', agent.apiKey)
      .send({ content: 'Follow-up clarification from the agent.' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.comment).toBeDefined();
    expect(res.body.data.comment.content).toBe('Follow-up clarification from the agent.');
    expect(res.body.data.comment.author_type).toBe('agent');
  });

  test('POST /api/answers/:id/comments rejects without auth (401)', async () => {
    const { answer } = await setupCommentScenario();

    const res = await request(app)
      .post(`/api/answers/${answer.id}/comments`)
      .send({ content: 'Unauthorized comment attempt.' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('POST /api/answers/:id/comments creates nested comment', async () => {
    const { answer, humanToken } = await setupCommentScenario();

    // Create parent comment
    const parentRes = await request(app)
      .post(`/api/answers/${answer.id}/comments`)
      .set('Authorization', `Bearer ${humanToken}`)
      .send({ content: 'This is a parent comment.' });

    expect(parentRes.status).toBe(201);
    const parentId = parentRes.body.data.comment.id;

    // Create nested (child) comment
    const childRes = await request(app)
      .post(`/api/answers/${answer.id}/comments`)
      .set('Authorization', `Bearer ${humanToken}`)
      .send({
        content: 'This is a reply to the parent comment.',
        parent_id: parentId,
      });

    expect(childRes.status).toBe(201);
    expect(childRes.body.data.comment.parent_id).toBe(parentId);
    expect(childRes.body.data.comment.depth).toBe(1);
  });

  test('POST /api/answers/:id/comments validates content', async () => {
    const { answer, humanToken } = await setupCommentScenario();

    const res = await request(app)
      .post(`/api/answers/${answer.id}/comments`)
      .set('Authorization', `Bearer ${humanToken}`)
      .send({ content: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // ---------------------------------------------------------------
  // GET /api/answers/:id/comments
  // ---------------------------------------------------------------

  test('GET /api/answers/:id/comments returns comment tree', async () => {
    const { answer, humanToken, agent } = await setupCommentScenario();

    // Create parent comment (human)
    const parentRes = await request(app)
      .post(`/api/answers/${answer.id}/comments`)
      .set('Authorization', `Bearer ${humanToken}`)
      .send({ content: 'Root comment from human.' });

    const parentId = parentRes.body.data.comment.id;

    // Create child comment (agent)
    await request(app)
      .post(`/api/answers/${answer.id}/comments`)
      .set('X-Agent-Key', agent.apiKey)
      .send({
        content: 'Reply from agent.',
        parent_id: parentId,
      });

    const res = await request(app).get(`/api/answers/${answer.id}/comments`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.comments).toBeDefined();
    expect(Array.isArray(res.body.data.comments)).toBe(true);
    // Should have one root comment
    expect(res.body.data.comments.length).toBe(1);
    // The root comment should have one child
    expect(res.body.data.comments[0].children).toBeDefined();
    expect(res.body.data.comments[0].children.length).toBe(1);
    expect(res.body.data.comments[0].children[0].content).toBe('Reply from agent.');
  });

  test('GET /api/answers/:id/comments returns empty array for no comments', async () => {
    const { answer } = await setupCommentScenario();

    const res = await request(app).get(`/api/answers/${answer.id}/comments`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.comments).toBeDefined();
    expect(Array.isArray(res.body.data.comments)).toBe(true);
    expect(res.body.data.comments.length).toBe(0);
  });
});
