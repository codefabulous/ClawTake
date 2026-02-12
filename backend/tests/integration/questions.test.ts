import request from 'supertest';
import { createApp } from '../../src/app';
import { getTestPool, truncateAllTables, closeTestPool } from '../helpers/db';
import { createTestUser, createTestQuestion, createTestTag } from '../helpers/fixtures';
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

describe('Question routes', () => {
  // ---------------------------------------------------------------
  // POST /api/questions
  // ---------------------------------------------------------------

  test('POST /api/questions creates question with auth (201)', async () => {
    const user = await createTestUser(pool);
    const token = createTestHumanToken(user.id);

    const res = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'What is the best way to test Express APIs?',
        body: 'I am trying to write integration tests for my Express application and want to know best practices.',
        tags: ['testing', 'express'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.question).toBeDefined();
    expect(res.body.data.question.title).toBe('What is the best way to test Express APIs?');
    expect(res.body.data.question.tags).toBeDefined();
    expect(Array.isArray(res.body.data.question.tags)).toBe(true);
    expect(res.body.data.question.tags.length).toBe(2);
  });

  test('POST /api/questions rejects without auth (401)', async () => {
    const res = await request(app)
      .post('/api/questions')
      .send({
        title: 'What is the best way to test Express APIs?',
        body: 'I am trying to write integration tests for my Express application and want to know best practices.',
        tags: ['testing'],
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('POST /api/questions validates title length', async () => {
    const user = await createTestUser(pool);
    const token = createTestHumanToken(user.id);

    const res = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Short',
        body: 'This body is long enough to pass validation easily.',
        tags: ['testing'],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('POST /api/questions validates tags array (1-3 required)', async () => {
    const user = await createTestUser(pool);
    const token = createTestHumanToken(user.id);

    // Empty tags array
    const res = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'A valid title that is long enough to pass',
        body: 'This body is long enough to pass validation easily.',
        tags: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // ---------------------------------------------------------------
  // GET /api/questions
  // ---------------------------------------------------------------

  test('GET /api/questions returns questions list', async () => {
    const user = await createTestUser(pool);
    await createTestQuestion(pool, user.id, { title: 'First question about testing' });
    await createTestQuestion(pool, user.id, { title: 'Second question about testing' });

    const res = await request(app).get('/api/questions');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.questions).toBeDefined();
    expect(Array.isArray(res.body.data.questions)).toBe(true);
    expect(res.body.data.questions.length).toBe(2);
  });

  test('GET /api/questions?sort=new orders by newest', async () => {
    const user = await createTestUser(pool);
    const q1 = await createTestQuestion(pool, user.id, { title: 'Older question about things' });

    // Small delay to ensure different created_at timestamps
    await new Promise(resolve => setTimeout(resolve, 50));

    const q2 = await createTestQuestion(pool, user.id, { title: 'Newer question about things' });

    const res = await request(app).get('/api/questions?sort=new');

    expect(res.status).toBe(200);
    expect(res.body.data.questions.length).toBe(2);
    // Newest first
    expect(res.body.data.questions[0].id).toBe(q2.id);
    expect(res.body.data.questions[1].id).toBe(q1.id);
  });

  test('GET /api/questions?tag=X filters by tag', async () => {
    const user = await createTestUser(pool);
    const q1 = await createTestQuestion(pool, user.id, { title: 'Question about JavaScript' });
    const q2 = await createTestQuestion(pool, user.id, { title: 'Question about Python language' });

    // Create tags and associate them
    const jsTag = await createTestTag(pool, 'javascript');
    const pyTag = await createTestTag(pool, 'python');

    await pool.query(
      'INSERT INTO question_tags (question_id, tag_id) VALUES ($1, $2)',
      [q1.id, jsTag.id]
    );
    await pool.query(
      'INSERT INTO question_tags (question_id, tag_id) VALUES ($1, $2)',
      [q2.id, pyTag.id]
    );

    const res = await request(app).get('/api/questions?tag=javascript');

    expect(res.status).toBe(200);
    expect(res.body.data.questions.length).toBe(1);
    expect(res.body.data.questions[0].id).toBe(q1.id);
  });

  // ---------------------------------------------------------------
  // GET /api/questions/:id
  // ---------------------------------------------------------------

  test('GET /api/questions/:id returns question detail', async () => {
    const user = await createTestUser(pool);
    const question = await createTestQuestion(pool, user.id, {
      title: 'Detail question about integration tests',
    });

    const res = await request(app).get(`/api/questions/${question.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.question).toBeDefined();
    expect(res.body.data.question.id).toBe(question.id);
    expect(res.body.data.question.title).toBe('Detail question about integration tests');
  });

  test('GET /api/questions/:id returns 404 for unknown id', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).get(`/api/questions/${fakeUuid}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
