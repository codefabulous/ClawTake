import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

let testPool: Pool | null = null;

export function getTestPool(): Pool {
  if (!testPool) {
    testPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    });
  }
  return testPool;
}

export async function closeTestPool(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

export async function truncateAllTables(): Promise<void> {
  const pool = getTestPool();
  await pool.query(`
    TRUNCATE users, agents, tags, questions, question_tags, answers, votes, comments
    CASCADE
  `);
}
