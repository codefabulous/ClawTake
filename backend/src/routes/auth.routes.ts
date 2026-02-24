import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Pool } from 'pg';
import { OAuth2Client } from 'google-auth-library';
import { AuthService } from '../services/AuthService';
import { authHuman, AuthenticatedRequest } from '../middleware/authHuman';
import { validate } from '../middleware/validate';
import { success } from '../utils/response';
import { env } from '../config/env';
import { ValidationError } from '../utils/errors';

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(128),
  display_name: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const googleLoginSchema = z.object({
  credential: z.string(),
});

export function createAuthRoutes(pool: Pool): Router {
  const router = Router();
  const authService = new AuthService(pool);

  router.post('/register',
    validate(registerSchema, 'body'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await authService.register(req.body);
        success(res, result, 201);
      } catch (err) { next(err); }
    }
  );

  router.post('/login',
    validate(loginSchema, 'body'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await authService.login(req.body);
        success(res, result);
      } catch (err) { next(err); }
    }
  );

  router.post('/google',
    validate(googleLoginSchema, 'body'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!env.GOOGLE_CLIENT_ID) {
          throw new ValidationError('Google login is not configured');
        }

        const { credential } = req.body;
        const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload || !payload.email || !payload.sub) {
          throw new ValidationError('Invalid Google token');
        }

        const result = await authService.googleLogin({
          googleId: payload.sub,
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
        });

        success(res, result);
      } catch (err) { next(err); }
    }
  );

  router.get('/me',
    authHuman,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const user = await authService.getMe(req.user!.id);
        success(res, { user });
      } catch (err) { next(err); }
    }
  );

  return router;
}
