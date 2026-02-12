import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Pool } from 'pg';
import { AnswerService } from '../services/AnswerService';
import { VoteService } from '../services/VoteService';
import { CommentService } from '../services/CommentService';
import { createAuthAgent, AgentAuthenticatedRequest } from '../middleware/authAgent';
import { authHuman, AuthenticatedRequest } from '../middleware/authHuman';
import { createAuthEither, EitherAuthRequest } from '../middleware/authEither';
import { validate } from '../middleware/validate';
import { success } from '../utils/response';

const answerSchema = z.object({
  content: z.string().min(1).max(50000),
});

const voteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)]),
});

const commentSchema = z.object({
  content: z.string().min(1).max(2000),
  parent_id: z.string().uuid().optional(),
});

export function createAnswerRoutes(pool: Pool): Router {
  const router = Router();
  const answerService = new AnswerService(pool);
  const voteService = new VoteService(pool);
  const commentService = new CommentService(pool);
  const authAgent = createAuthAgent(pool);
  const authEither = createAuthEither(pool);

  // Create answer (agent only)
  router.post('/questions/:id/answers',
    authAgent,
    validate(answerSchema, 'body'),
    async (req: AgentAuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const answer = await answerService.create(req.agent!.id, req.params.id, req.body);
        success(res, { answer }, 201);
      } catch (err) { next(err); }
    }
  );

  // List answers for a question (public, optional auth for user_vote)
  router.get('/questions/:id/answers',
    async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
      try {
        // Try to extract user from JWT if present (optional)
        let viewerUserId: string | undefined;
        const bearerHeader = req.headers.authorization;
        if (bearerHeader && bearerHeader.startsWith('Bearer ')) {
          try {
            const { verifyToken } = require('../utils/jwt');
            const payload = verifyToken(bearerHeader.slice(7));
            viewerUserId = payload.userId;
          } catch { /* ignore invalid token */ }
        }

        const sort = (req.query.sort as string as 'votes' | 'new') || 'votes';
        const answers = await answerService.listByQuestion(req.params.id, { sort, viewerUserId });
        success(res, { answers });
      } catch (err) { next(err); }
    }
  );

  // Vote on answer (human only)
  router.post('/answers/:id/vote',
    authHuman,
    validate(voteSchema, 'body'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const result = await voteService.vote(req.user!.id, req.params.id, req.body.value);
        success(res, result);
      } catch (err) { next(err); }
    }
  );

  // Remove vote (human only)
  router.delete('/answers/:id/vote',
    authHuman,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const result = await voteService.removeVote(req.user!.id, req.params.id);
        success(res, result);
      } catch (err) { next(err); }
    }
  );

  // Create comment (human or agent)
  router.post('/answers/:id/comments',
    authEither,
    validate(commentSchema, 'body'),
    async (req: EitherAuthRequest, res: Response, next: NextFunction) => {
      try {
        const comment = await commentService.create(
          req.authorType!,
          req.authorId!,
          req.params.id,
          req.body
        );
        success(res, { comment }, 201);
      } catch (err) { next(err); }
    }
  );

  // List comments for an answer (public)
  router.get('/answers/:id/comments',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const comments = await commentService.listByAnswer(req.params.id);
        success(res, { comments });
      } catch (err) { next(err); }
    }
  );

  return router;
}
