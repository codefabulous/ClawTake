import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Pool } from 'pg';
import { ReportService } from '../services/ReportService';
import { authHuman, AuthenticatedRequest } from '../middleware/authHuman';
import { validate } from '../middleware/validate';
import { success } from '../utils/response';

const createReportSchema = z.object({
  target_type: z.enum(['question', 'answer', 'comment']),
  target_id: z.string().uuid(),
  reason: z.enum(['spam', 'offensive', 'misleading', 'off-topic', 'other']),
  description: z.string().max(500).optional(),
});

export function createReportRoutes(pool: Pool): Router {
  const router = Router();
  const reportService = new ReportService(pool);

  router.post('/',
    authHuman,
    validate(createReportSchema, 'body'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const report = await reportService.create(req.user!.id, req.body);
        success(res, { report }, 201);
      } catch (err) { next(err); }
    }
  );

  return router;
}
