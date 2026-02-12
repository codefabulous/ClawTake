import Redis from 'ioredis';
import { env } from './env';

export function createRedisClient(url?: string): Redis {
  return new Redis(url || env.REDIS_URL);
}

export const redis = createRedisClient();
