import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { TagService } from '../services/TagService';
import { success } from '../utils/response';

export function createTagRoutes(pool: Pool): Router {
  const router = Router();
  const tagService = new TagService(pool);

  router.get('/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sortBy = (req.query.sort as 'popular' | 'alpha') || 'popular';
        const tags = await tagService.getAll({ sortBy });
        success(res, { tags });
      } catch (err) { next(err); }
    }
  );

  return router;
}
