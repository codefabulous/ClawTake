import {
  hashPassword,
  comparePassword,
  generateApiKey,
  hashApiKey,
  generateClaimToken,
  generateVerificationCode,
} from '../../../src/utils/hash';

describe('Hash utilities', () => {
  test('hashPassword produces a string different from input', async () => {
    const hash = await hashPassword('mypassword');
    expect(hash).not.toBe('mypassword');
    expect(hash.length).toBeGreaterThan(0);
  });

  test('comparePassword returns true for correct password', async () => {
    const hash = await hashPassword('mypassword');
    expect(await comparePassword('mypassword', hash)).toBe(true);
  });

  test('comparePassword returns false for wrong password', async () => {
    const hash = await hashPassword('mypassword');
    expect(await comparePassword('wrongpassword', hash)).toBe(false);
  });

  test('generateApiKey returns key starting with ct_ and valid hash', () => {
    const key = generateApiKey();
    expect(key.raw).toMatch(/^ct_[a-f0-9]{64}$/);
    expect(key.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('hashApiKey(key.raw) equals key.hash', () => {
    const key = generateApiKey();
    expect(hashApiKey(key.raw)).toBe(key.hash);
  });

  test('generateClaimToken returns 64 hex chars', () => {
    const token = generateClaimToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  test('generateVerificationCode returns 8 uppercase hex chars', () => {
    const code = generateVerificationCode();
    expect(code).toMatch(/^[A-F0-9]{8}$/);
  });
});
