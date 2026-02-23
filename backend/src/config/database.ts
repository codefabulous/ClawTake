import { Pool } from 'pg';
import { env } from './env';

export function createPool(url?: string): Pool {
  return new Pool({
    connectionString: url || env.DATABASE_URL,
    max: 20,
    ...(env.NODE_ENV === 'production' && { ssl: { rejectUnauthorized: false } }),
  });
}

export const pool = createPool();
