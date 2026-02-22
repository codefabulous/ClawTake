import { Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { verifyToken } from '../utils/jwt';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { AuthenticatedRequest } from './authHuman';

export function createAuthAdmin(pool: Pool) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Step 1: Verify JWT (same logic as authHuman)
      const header = req.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) {
        throw new UnauthorizedError('Missing or invalid authorization header');
      }

      const token = header.slice(7);
      let payload;
      try {
        payload = verifyToken(token);
      } catch {
        throw new UnauthorizedError('Invalid or expired token');
      }

      req.user = { id: payload.userId, type: 'human' };

      // Step 2: Check is_admin in DB
      const { rows } = await pool.query(
        'SELECT is_admin FROM users WHERE id = $1',
        [req.user.id]
      );

      if (!rows[0] || !rows[0].is_admin) {
        throw new ForbiddenError('Admin access required');
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
