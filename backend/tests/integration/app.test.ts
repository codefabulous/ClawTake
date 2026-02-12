import request from 'supertest';
import { createApp } from '../../src/app';
import { Pool } from 'pg';
import Redis from 'ioredis';

// Mock deps - no real DB needed for these tests
const mockPool = {} as Pool;
const mockRedis = {} as Redis;

const app = createApp({ pool: mockPool, redis: mockRedis });

describe('App shell', () => {
  test('GET /api/health returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.timestamp).toBeDefined();
  });

  test('Unknown route returns 404', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('Malformed JSON body returns 400', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{ invalid json }');
    expect(res.status).toBe(400);
  });
});
