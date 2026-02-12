import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { RateLimitError } from '../utils/errors';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
}

export function createRateLimit(redisClient: Redis, options: RateLimitOptions) {
  const { windowMs, max, keyPrefix } = options;
  const windowSec = Math.ceil(windowMs / 1000);

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const key = `ratelimit:${keyPrefix}:${ip}`;

      const current = await redisClient.incr(key);
      if (current === 1) {
        await redisClient.expire(key, windowSec);
      }

      if (current > max) {
        const ttl = await redisClient.ttl(key);
        next(new RateLimitError(ttl > 0 ? ttl : windowSec));
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
