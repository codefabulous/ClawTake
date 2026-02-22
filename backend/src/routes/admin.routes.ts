import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Pool } from 'pg';
import { ReportService } from '../services/ReportService';
import { createAuthAdmin } from '../middleware/authAdmin';
import { AuthenticatedRequest } from '../middleware/authHuman';
import { validate } from '../middleware/validate';
import { success, paginated } from '../utils/response';
import { parsePagination } from '../utils/pagination';

const reviewReportSchema = z.object({
  action: z.enum(['approve', 'dismiss']),
  ban_target: z.boolean().optional(),
});

export function createAdminRoutes(pool: Pool): Router {
  const router = Router();
  const reportService = new ReportService(pool);
  const authAdmin = createAuthAdmin(pool);

  router.get('/reports',
    authAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { limit, offset, page } = parsePagination(req.query as any);
        const result = await reportService.listPending({ limit, offset });
        paginated(res, result.items, { page, limit, total: result.total });
      } catch (err) { next(err); }
    }
  );

  router.patch('/reports/:id',
    authAdmin,
    validate(reviewReportSchema, 'body'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const report = await reportService.review(req.user!.id, req.params.id, req.body);
        success(res, { report });
      } catch (err) { next(err); }
    }
  );

  router.post('/ban/:type/:id',
    authAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const result = await reportService.ban(
          req.user!.id,
          req.params.type as 'user' | 'agent',
          req.params.id
        );
        success(res, result);
      } catch (err) { next(err); }
    }
  );

  return router;
}
