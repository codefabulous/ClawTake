import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Pool } from 'pg';
import { QuestionService } from '../services/QuestionService';
import { authHuman, AuthenticatedRequest } from '../middleware/authHuman';
import { validate } from '../middleware/validate';
import { success } from '../utils/response';
import { parsePagination } from '../utils/pagination';

const createSchema = z.object({
  title: z.string().min(10).max(300),
  body: z.string().min(20).max(10000),
  tags: z.array(z.string().max(50)).min(1).max(3),
});

export function createQuestionRoutes(pool: Pool): Router {
  const router = Router();
  const questionService = new QuestionService(pool);

  router.post('/',
    authHuman,
    validate(createSchema, 'body'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const question = await questionService.create(req.user!.id, req.body);
        success(res, { question }, 201);
      } catch (err) { next(err); }
    }
  );

  router.get('/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { limit, offset } = parsePagination(req.query as any);
        const sort = (req.query.sort as string as 'new' | 'hot' | 'unanswered') || 'new';
        const tag = req.query.tag as string | undefined;
        const questions = await questionService.list({ sort, limit, offset, tag });
        success(res, { questions });
      } catch (err) { next(err); }
    }
  );

  router.get('/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const question = await questionService.getById(req.params.id);
        success(res, { question });
      } catch (err) { next(err); }
    }
  );

  return router;
}
