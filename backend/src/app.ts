import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { errorHandler } from './middleware/errorHandler';
import { createRoutes } from './routes';

export interface AppDeps {
  pool: Pool;
  redis: Redis;
}

export function createApp(deps: AppDeps) {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
  app.use(helmet());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
  });

  // Mount routes
  app.use('/api', createRoutes(deps));

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
