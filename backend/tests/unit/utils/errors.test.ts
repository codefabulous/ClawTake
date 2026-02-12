import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
} from '../../../src/utils/errors';

describe('Error classes', () => {
  test('AppError stores statusCode and message', () => {
    const err = new AppError(418, 'teapot', 'TEAPOT');
    expect(err.statusCode).toBe(418);
    expect(err.message).toBe('teapot');
    expect(err.code).toBe('TEAPOT');
    expect(err).toBeInstanceOf(Error);
  });

  test('NotFoundError has status 404', () => {
    const err = new NotFoundError('User');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('User not found');
    expect(err.code).toBe('NOT_FOUND');
  });

  test('ValidationError has status 400', () => {
    const err = new ValidationError('invalid input');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  test('UnauthorizedError has status 401', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
  });

  test('ForbiddenError has status 403', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
  });

  test('ConflictError has status 409', () => {
    const err = new ConflictError('already exists');
    expect(err.statusCode).toBe(409);
  });

  test('RateLimitError has status 429', () => {
    const err = new RateLimitError(60);
    expect(err.statusCode).toBe(429);
    expect(err.message).toContain('60');
  });
});
