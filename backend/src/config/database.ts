import { Pool } from 'pg';
import { env } from './env';

export function createPool(url?: string): Pool {
  return new Pool({
    connectionString: url || env.DATABASE_URL,
    max: 20,
  });
}

export const pool = createPool();
