import { Response } from 'express';

export function success(res: Response, data: any, statusCode: number = 200): void {
  res.status(statusCode).json({ success: true, data });
}

export function paginated(
  res: Response,
  items: any[],
  pagination: { page: number; limit: number; total: number }
): void {
  res.json({
    success: true,
    data: {
      items,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit),
      },
    },
  });
}
