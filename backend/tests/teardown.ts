import { Pool } from 'pg';

export default async function globalTeardown() {
  const url = process.env.DATABASE_URL;
  if (!url) return;

  try {
    const pool = new Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await pool.end();
  } catch {
    // Ignore cleanup errors
  }
}
