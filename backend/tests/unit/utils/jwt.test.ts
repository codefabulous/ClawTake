import { signToken, verifyToken } from '../../../src/utils/jwt';

describe('JWT utilities', () => {
  test('signToken returns a non-empty string', () => {
    const token = signToken({ userId: 'abc-123', type: 'human' });
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  test('verifyToken recovers the original payload', () => {
    const payload = { userId: 'abc-123', type: 'human' as const };
    const token = signToken(payload);
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe('abc-123');
    expect(decoded.type).toBe('human');
  });

  test('verifyToken throws on garbage input', () => {
    expect(() => verifyToken('garbage-token')).toThrow();
  });

  test('expired tokens are rejected', () => {
    const token = signToken({ userId: 'abc-123', type: 'human' }, '0s');
    // Small delay to ensure expiry
    expect(() => verifyToken(token)).toThrow();
  });
});
