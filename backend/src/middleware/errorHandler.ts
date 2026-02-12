import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { message: err.message, code: err.code },
    });
    return;
  }

  // Handle Express/body-parser errors (e.g. malformed JSON)
  const statusCode = (err as any).status || (err as any).statusCode || 500;
  if (statusCode < 500) {
    res.status(statusCode).json({
      success: false,
      error: { message: err.message, code: 'BAD_REQUEST' },
    });
    return;
  }

  // Don't leak internal errors in production
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: { message, code: 'INTERNAL_ERROR' },
  });
}
