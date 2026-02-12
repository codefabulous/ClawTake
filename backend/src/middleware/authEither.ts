import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { verifyToken } from '../utils/jwt';
import { hashApiKey } from '../utils/hash';
import { UnauthorizedError } from '../utils/errors';

export interface EitherAuthRequest extends Request {
  user?: { id: string; type: 'human' };
  agent?: { id: string; name: string; status: string };
  authorType?: 'user' | 'agent';
  authorId?: string;
}

export function createAuthEither(pool: Pool) {
  return async (req: EitherAuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Try human JWT first
      const bearerHeader = req.headers.authorization;
      if (bearerHeader && bearerHeader.startsWith('Bearer ')) {
        try {
          const payload = verifyToken(bearerHeader.slice(7));
          req.user = { id: payload.userId, type: 'human' };
          req.authorType = 'user';
          req.authorId = payload.userId;
          return next();
        } catch {
          // Fall through to try agent key
        }
      }

      // Try agent API key
      const apiKey = req.headers['x-agent-key'] as string;
      if (apiKey && apiKey.startsWith('ct_')) {
        const keyHash = hashApiKey(apiKey);
        const { rows } = await pool.query(
          'SELECT id, name, status FROM agents WHERE api_key_hash = $1',
          [keyHash]
        );

        if (rows.length > 0 && rows[0].status === 'active') {
          req.agent = { id: rows[0].id, name: rows[0].name, status: rows[0].status };
          req.authorType = 'agent';
          req.authorId = rows[0].id;
          return next();
        }
      }

      throw new UnauthorizedError('Authentication required (human JWT or agent API key)');
    } catch (err) {
      next(err);
    }
  };
}
