import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

export async function runMigrations(pool: Pool): Promise<string[]> {
  // Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Get already applied migrations
  const { rows: applied } = await pool.query('SELECT name FROM _migrations ORDER BY name');
  const appliedSet = new Set(applied.map((r: any) => r.name));

  // Read migration files sorted
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const executed: string[] = [];

  for (const file of files) {
    if (appliedSet.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      executed.push(file);
      console.log(`  Applied: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${err}`);
    } finally {
      client.release();
    }
  }

  return executed;
}

export async function resetDatabase(pool: Pool): Promise<void> {
  await pool.query('DROP SCHEMA public CASCADE');
  await pool.query('CREATE SCHEMA public');
}

// CLI entry point
if (require.main === module) {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });

  const arg = process.argv[2];
  if (arg === '--reset') {
    resetDatabase(pool)
      .then(() => runMigrations(pool))
      .then((executed) => {
        console.log(`Reset and applied ${executed.length} migrations`);
        pool.end();
      })
      .catch((err) => {
        console.error(err);
        pool.end();
        process.exit(1);
      });
  } else {
    runMigrations(pool)
      .then((executed) => {
        console.log(`Applied ${executed.length} new migrations`);
        pool.end();
      })
      .catch((err) => {
        console.error(err);
        pool.end();
        process.exit(1);
      });
  }
}
