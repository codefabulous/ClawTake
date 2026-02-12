import request from 'supertest';
import { createApp } from '../../src/app';
import { getTestPool, truncateAllTables, closeTestPool } from '../helpers/db';
import { createTestUser } from '../helpers/fixtures';
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

describe('Auth routes', () => {
  // ---------------------------------------------------------------
  // POST /api/auth/register
  // ---------------------------------------------------------------

  test('POST /api/auth/register creates user and returns token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'newuser@test.com',
        username: 'newuser',
        password: 'password123',
        display_name: 'New User',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe('newuser@test.com');
    expect(res.body.data.user.username).toBe('newuser');
    expect(res.body.data.user.display_name).toBe('New User');
    expect(res.body.data.user.password_hash).toBeUndefined();
    expect(res.body.data.token).toBeDefined();
    expect(typeof res.body.data.token).toBe('string');
  });

  test('POST /api/auth/register rejects duplicate email', async () => {
    const user = await createTestUser(pool, { email: 'dup@test.com' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'dup@test.com',
        username: 'different_user',
        password: 'password123',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  test('POST /api/auth/register rejects duplicate username', async () => {
    const user = await createTestUser(pool, { username: 'taken_name' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'unique@test.com',
        username: 'taken_name',
        password: 'password123',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  test('POST /api/auth/register validates password length (min 8)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'short@test.com',
        username: 'shortpw',
        password: 'short',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('POST /api/auth/register validates required fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // ---------------------------------------------------------------
  // POST /api/auth/login
  // ---------------------------------------------------------------

  test('POST /api/auth/login returns token for valid credentials', async () => {
    const user = await createTestUser(pool, {
      email: 'login@test.com',
      username: 'loginuser',
      password: 'mypassword1',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login@test.com',
        password: 'mypassword1',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe('login@test.com');
    expect(res.body.data.user.password_hash).toBeUndefined();
    expect(res.body.data.token).toBeDefined();
    expect(typeof res.body.data.token).toBe('string');
  });

  test('POST /api/auth/login rejects wrong password', async () => {
    await createTestUser(pool, {
      email: 'wrongpw@test.com',
      username: 'wrongpwuser',
      password: 'correctpass1',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'wrongpw@test.com',
        password: 'wrongpassword',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('POST /api/auth/login rejects non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@test.com',
        password: 'somepassword',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  // ---------------------------------------------------------------
  // GET /api/auth/me
  // ---------------------------------------------------------------

  test('GET /api/auth/me returns user with valid token', async () => {
    const user = await createTestUser(pool, {
      email: 'me@test.com',
      username: 'meuser',
    });
    const token = createTestHumanToken(user.id);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe('me@test.com');
    expect(res.body.data.user.username).toBe('meuser');
    expect(res.body.data.user.password_hash).toBeUndefined();
  });

  test('GET /api/auth/me rejects without token (401)', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
