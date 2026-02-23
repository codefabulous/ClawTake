import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { AgentService } from '../services/AgentService';
import { AgentFeedService } from '../services/AgentFeedService';
import { createAuthAgent, AgentAuthenticatedRequest } from '../middleware/authAgent';
import { validate } from '../middleware/validate';
import { createRateLimit } from '../middleware/rateLimit';
import { success } from '../utils/response';
import { parsePagination } from '../utils/pagination';

const registerSchema = z.object({
  name: z.string().min(3).max(50).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  display_name: z.string().min(1).max(100),
  bio: z.string().max(500).optional(),
  expertise_tags: z.array(z.string().max(50)).max(5).optional(),
});

const updateSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional(),
  expertise_tags: z.array(z.string().max(50)).max(5).optional(),
});

const claimSchema = z.object({
  claim_token: z.string().length(64),
  tweet_url: process.env.SKIP_VERIFICATION === 'true'
    ? z.string().url().optional()
    : z.string().url(),
});

const ackSchema = z.object({
  question_ids: z.array(z.string().uuid()).min(1).max(50),
});

export function createAgentRoutes(pool: Pool, redis: Redis): Router {
  const router = Router();
  const agentService = new AgentService(pool);
  const feedService = new AgentFeedService(pool);
  const authAgent = createAuthAgent(pool);
  const registerLimit = createRateLimit(redis, { windowMs: 3600000, max: 3, keyPrefix: 'agent-register' });

  router.post('/register',
    registerLimit,
    validate(registerSchema, 'body'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await agentService.register(req.body);
        success(res, result, 201);
      } catch (err) { next(err); }
    }
  );

  router.get('/leaderboard',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { limit, offset } = parsePagination(req.query as any);
        const tag = req.query.tag as string | undefined;
        const agents = await agentService.getLeaderboard({ tag, limit, offset });
        success(res, { agents });
      } catch (err) { next(err); }
    }
  );

  // Agent feed routes — MUST be before /:name to avoid "me" being treated as a name
  router.get('/me/feed',
    authAgent,
    async (req: AgentAuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
        const result = await feedService.getFeed(req.agent!.id, { limit });
        success(res, result);
      } catch (err) { next(err); }
    }
  );

  router.post('/me/feed/ack',
    authAgent,
    validate(ackSchema, 'body'),
    async (req: AgentAuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const result = await feedService.acknowledge(req.agent!.id, req.body.question_ids);
        success(res, result);
      } catch (err) { next(err); }
    }
  );

  router.get('/claim/:token',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const claimInfo = await agentService.getClaimInfo(req.params.token);
        success(res, claimInfo);
      } catch (err) { next(err); }
    }
  );

  router.post('/claim',
    validate(claimSchema, 'body'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const agent = await agentService.claimAgent(req.body.claim_token, req.body.tweet_url);
        success(res, { agent });
      } catch (err) { next(err); }
    }
  );

  router.get('/:name',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const agent = await agentService.getByName(req.params.name);
        success(res, { agent });
      } catch (err) { next(err); }
    }
  );

  router.patch('/me',
    authAgent,
    validate(updateSchema, 'body'),
    async (req: AgentAuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const agent = await agentService.updateProfile(req.agent!.id, req.body);
        success(res, { agent });
      } catch (err) { next(err); }
    }
  );

  return router;
}
