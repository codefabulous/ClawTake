import request from 'supertest';
import { createApp } from '../../src/app';
import { getTestPool, truncateAllTables, closeTestPool } from '../helpers/db';
import { createTestAgent } from '../helpers/fixtures';
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

describe('Agent routes', () => {
  // ---------------------------------------------------------------
  // POST /api/agents/register
  // ---------------------------------------------------------------

  test('POST /api/agents/register creates agent and returns api_key', async () => {
    const res = await request(app)
      .post('/api/agents/register')
      .send({
        name: 'test-agent-01',
        display_name: 'Test Agent 01',
        bio: 'A test agent for integration testing',
        expertise_tags: ['javascript', 'testing'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.agent).toBeDefined();
    expect(res.body.data.agent.name).toBe('test-agent-01');
    expect(res.body.data.api_key).toBeDefined();
    expect(res.body.data.api_key).toMatch(/^ct_/);
    expect(res.body.data.claim_url).toBeDefined();
    expect(res.body.data.verification_code).toBeDefined();
  });

  test('POST /api/agents/register validates name format', async () => {
    const res = await request(app)
      .post('/api/agents/register')
      .send({
        name: '-invalid-name-',
        display_name: 'Invalid',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('POST /api/agents/register rejects duplicate name', async () => {
    // Create an agent first via the route
    await request(app)
      .post('/api/agents/register')
      .send({
        name: 'dup-agent',
        display_name: 'Dup Agent',
      });

    // Try to create another agent with the same name
    const res = await request(app)
      .post('/api/agents/register')
      .send({
        name: 'dup-agent',
        display_name: 'Dup Agent 2',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  // ---------------------------------------------------------------
  // GET /api/agents/leaderboard
  // ---------------------------------------------------------------

  test('GET /api/agents/leaderboard returns agents sorted by reputation', async () => {
    const agent1 = await createTestAgent(pool, {
      name: 'agent-low',
      display_name: 'Low Rep',
    });
    const agent2 = await createTestAgent(pool, {
      name: 'agent-high',
      display_name: 'High Rep',
    });

    // Give agent2 higher reputation
    await pool.query('UPDATE agents SET reputation_score = 100 WHERE id = $1', [agent2.id]);
    await pool.query('UPDATE agents SET reputation_score = 10 WHERE id = $1', [agent1.id]);

    const res = await request(app).get('/api/agents/leaderboard');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.agents).toBeDefined();
    expect(Array.isArray(res.body.data.agents)).toBe(true);
    expect(res.body.data.agents.length).toBe(2);
    // Higher reputation first
    expect(res.body.data.agents[0].name).toBe('agent-high');
    expect(res.body.data.agents[1].name).toBe('agent-low');
  });

  test('GET /api/agents/leaderboard filters by tag', async () => {
    await createTestAgent(pool, {
      name: 'agent-js',
      display_name: 'JS Agent',
      expertise_tags: ['javascript'],
    });
    await createTestAgent(pool, {
      name: 'agent-py',
      display_name: 'Python Agent',
      expertise_tags: ['python'],
    });

    const res = await request(app).get('/api/agents/leaderboard?tag=javascript');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.agents.length).toBe(1);
    expect(res.body.data.agents[0].name).toBe('agent-js');
  });

  // ---------------------------------------------------------------
  // GET /api/agents/:name
  // ---------------------------------------------------------------

  test('GET /api/agents/:name returns agent profile', async () => {
    const agent = await createTestAgent(pool, {
      name: 'profile-agent',
      display_name: 'Profile Agent',
      bio: 'Test bio',
    });

    const res = await request(app).get('/api/agents/profile-agent');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.agent).toBeDefined();
    expect(res.body.data.agent.name).toBe('profile-agent');
    expect(res.body.data.agent.display_name).toBe('Profile Agent');
    // Sensitive fields should be stripped
    expect(res.body.data.agent.api_key_hash).toBeUndefined();
    expect(res.body.data.agent.claim_token).toBeUndefined();
    expect(res.body.data.agent.verification_code).toBeUndefined();
  });

  test('GET /api/agents/:name returns 404 for unknown agent', async () => {
    const res = await request(app).get('/api/agents/nonexistent-agent');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  // ---------------------------------------------------------------
  // PATCH /api/agents/me
  // ---------------------------------------------------------------

  test('PATCH /api/agents/me updates profile with valid API key', async () => {
    const agent = await createTestAgent(pool, {
      name: 'update-agent',
      display_name: 'Original Name',
    });

    const res = await request(app)
      .patch('/api/agents/me')
      .set('X-Agent-Key', agent.apiKey)
      .send({
        display_name: 'Updated Name',
        bio: 'Updated bio',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.agent).toBeDefined();
    expect(res.body.data.agent.display_name).toBe('Updated Name');
    expect(res.body.data.agent.bio).toBe('Updated bio');
  });
});
