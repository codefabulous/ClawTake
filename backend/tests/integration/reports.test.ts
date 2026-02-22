import request from 'supertest';
import { createApp } from '../../src/app';
import { getTestPool, truncateAllTables, closeTestPool } from '../helpers/db';
import { createTestUser, createTestAgent, createTestQuestion, createTestAnswer, createTestAdminUser, createTestReport } from '../helpers/fixtures';
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

describe('Report routes', () => {
  // ---------------------------------------------------------------
  // POST /api/reports
  // ---------------------------------------------------------------

  test('POST /api/reports creates report with valid auth (201)', async () => {
    const author = await createTestUser(pool);
    const reporter = await createTestUser(pool);
    const question = await createTestQuestion(pool, author.id);
    const token = createTestHumanToken(reporter.id);

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        target_type: 'question',
        target_id: question.id,
        reason: 'spam',
        description: 'This is spam content',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.report).toBeDefined();
    expect(res.body.data.report.target_type).toBe('question');
    expect(res.body.data.report.target_id).toBe(question.id);
    expect(res.body.data.report.reason).toBe('spam');
    expect(res.body.data.report.status).toBe('pending');
  });

  test('POST /api/reports rejects without auth (401)', async () => {
    const author = await createTestUser(pool);
    const question = await createTestQuestion(pool, author.id);

    const res = await request(app)
      .post('/api/reports')
      .send({
        target_type: 'question',
        target_id: question.id,
        reason: 'spam',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('POST /api/reports rejects invalid reason (400)', async () => {
    const author = await createTestUser(pool);
    const reporter = await createTestUser(pool);
    const question = await createTestQuestion(pool, author.id);
    const token = createTestHumanToken(reporter.id);

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        target_type: 'question',
        target_id: question.id,
        reason: 'invalid_reason',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('POST /api/reports rejects duplicate report from same user (409)', async () => {
    const author = await createTestUser(pool);
    const reporter = await createTestUser(pool);
    const question = await createTestQuestion(pool, author.id);
    const token = createTestHumanToken(reporter.id);

    // First report succeeds
    await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        target_type: 'question',
        target_id: question.id,
        reason: 'spam',
      });

    // Second report from same user on same target fails
    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        target_type: 'question',
        target_id: question.id,
        reason: 'offensive',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  test('POST /api/reports rejects report on non-existent target (404)', async () => {
    const reporter = await createTestUser(pool);
    const token = createTestHumanToken(reporter.id);
    const fakeUuid = '00000000-0000-0000-0000-000000000000';

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        target_type: 'question',
        target_id: fakeUuid,
        reason: 'spam',
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('POST /api/reports auto-hides content at 3 reports', async () => {
    const author = await createTestUser(pool);
    const question = await createTestQuestion(pool, author.id);

    // Create 3 different reporters and each reports the question
    for (let i = 0; i < 3; i++) {
      const reporter = await createTestUser(pool);
      const token = createTestHumanToken(reporter.id);

      await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          target_type: 'question',
          target_id: question.id,
          reason: 'spam',
        });
    }

    // The question should now be hidden (is_deleted = true), so GET returns 404
    const res = await request(app).get(`/api/questions/${question.id}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  // ---------------------------------------------------------------
  // GET /api/admin/reports
  // ---------------------------------------------------------------

  test('GET /api/admin/reports returns pending reports for admin user (200)', async () => {
    const admin = await createTestAdminUser(pool);
    const adminToken = createTestHumanToken(admin.id);

    const author = await createTestUser(pool);
    const question = await createTestQuestion(pool, author.id);

    const reporter = await createTestUser(pool);
    await createTestReport(pool, {
      reporter_id: reporter.id,
      target_type: 'question',
      target_id: question.id,
      reason: 'spam',
    });

    const res = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toBeDefined();
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].target_type).toBe('question');
    expect(res.body.data.pagination).toBeDefined();
    expect(res.body.data.pagination.total).toBe(1);
  });

  test('GET /api/admin/reports rejects non-admin user (403)', async () => {
    const user = await createTestUser(pool);
    const token = createTestHumanToken(user.id);

    const res = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('GET /api/admin/reports rejects unauthenticated request (401)', async () => {
    const res = await request(app).get('/api/admin/reports');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  // ---------------------------------------------------------------
  // PATCH /api/admin/reports/:id
  // ---------------------------------------------------------------

  test('PATCH /api/admin/reports/:id approve action keeps content deleted and marks reports as reviewed', async () => {
    const admin = await createTestAdminUser(pool);
    const adminToken = createTestHumanToken(admin.id);

    const author = await createTestUser(pool);
    const question = await createTestQuestion(pool, author.id);

    // Auto-hide by creating 3 reports
    const reporters = [];
    for (let i = 0; i < 3; i++) {
      const reporter = await createTestUser(pool);
      reporters.push(reporter);
      await createTestReport(pool, {
        reporter_id: reporter.id,
        target_type: 'question',
        target_id: question.id,
        reason: 'spam',
      });
    }

    // Mark question as deleted (simulating auto-hide)
    await pool.query('UPDATE questions SET is_deleted = true WHERE id = $1', [question.id]);

    // Get the first report id
    const { rows: reportRows } = await pool.query(
      "SELECT id FROM reports WHERE target_id = $1 AND status = 'pending' LIMIT 1",
      [question.id]
    );
    const reportId = reportRows[0].id;

    const res = await request(app)
      .patch(`/api/admin/reports/${reportId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'approve' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.report.status).toBe('reviewed');

    // All reports for this question should be reviewed
    const { rows: allReports } = await pool.query(
      'SELECT * FROM reports WHERE target_id = $1',
      [question.id]
    );
    allReports.forEach((r: any) => {
      expect(r.status).toBe('reviewed');
      expect(r.reviewed_by).toBe(admin.id);
    });

    // Question should still be deleted
    const { rows: questionRows } = await pool.query(
      'SELECT is_deleted FROM questions WHERE id = $1',
      [question.id]
    );
    expect(questionRows[0].is_deleted).toBe(true);
  });

  test('PATCH /api/admin/reports/:id dismiss action restores content and marks reports as dismissed', async () => {
    const admin = await createTestAdminUser(pool);
    const adminToken = createTestHumanToken(admin.id);

    const author = await createTestUser(pool);
    const question = await createTestQuestion(pool, author.id);

    // Create a report
    const reporter = await createTestUser(pool);
    const report = await createTestReport(pool, {
      reporter_id: reporter.id,
      target_type: 'question',
      target_id: question.id,
      reason: 'spam',
    });

    // Mark question as deleted (simulating auto-hide)
    await pool.query('UPDATE questions SET is_deleted = true WHERE id = $1', [question.id]);

    const res = await request(app)
      .patch(`/api/admin/reports/${report.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'dismiss' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.report.status).toBe('dismissed');

    // Question should be restored (is_deleted = false)
    const { rows: questionRows } = await pool.query(
      'SELECT is_deleted FROM questions WHERE id = $1',
      [question.id]
    );
    expect(questionRows[0].is_deleted).toBe(false);
  });

  test('PATCH /api/admin/reports/:id rejects non-admin user (403)', async () => {
    const user = await createTestUser(pool);
    const token = createTestHumanToken(user.id);

    const author = await createTestUser(pool);
    const question = await createTestQuestion(pool, author.id);
    const report = await createTestReport(pool, {
      reporter_id: user.id,
      target_type: 'question',
      target_id: question.id,
      reason: 'spam',
    });

    const res = await request(app)
      .patch(`/api/admin/reports/${report.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'approve' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // ---------------------------------------------------------------
  // POST /api/admin/ban/:type/:id
  // ---------------------------------------------------------------

  test('POST /api/admin/ban/user/:id bans user', async () => {
    const admin = await createTestAdminUser(pool);
    const adminToken = createTestHumanToken(admin.id);

    const targetUser = await createTestUser(pool);

    const res = await request(app)
      .post(`/api/admin/ban/user/${targetUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify user is banned in DB
    const { rows } = await pool.query('SELECT is_banned FROM users WHERE id = $1', [targetUser.id]);
    expect(rows[0].is_banned).toBe(true);
  });

  test('POST /api/admin/ban/agent/:id suspends agent', async () => {
    const admin = await createTestAdminUser(pool);
    const adminToken = createTestHumanToken(admin.id);

    const agent = await createTestAgent(pool);

    const res = await request(app)
      .post(`/api/admin/ban/agent/${agent.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify agent is suspended in DB
    const { rows } = await pool.query('SELECT status FROM agents WHERE id = $1', [agent.id]);
    expect(rows[0].status).toBe('suspended');
  });
});
