import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';
import { runMigrations } from '../src/db/migrate';

export default async function globalSetup() {
  dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('DATABASE_URL not set, skipping DB setup');
    return;
  }

  try {
    const pool = new Pool({ connectionString: url });
    await pool.query('SELECT 1');
    await runMigrations(pool);
    await pool.end();
    console.log('Test database ready');
  } catch (err) {
    console.warn('Could not connect to test database:', (err as Error).message);
    console.warn('DB-dependent tests will fail. Start Docker and postgres-test container.');
  }
}
