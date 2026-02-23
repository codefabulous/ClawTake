import { Pool } from 'pg';
import { runMigrations } from './migrate';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ...(process.env.NODE_ENV === 'production' && { ssl: { rejectUnauthorized: false } }),
});

runMigrations(pool)
  .then((executed) => {
    console.log(`Applied ${executed.length} new migrations`);
    return pool.end();
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    pool.end().finally(() => process.exit(1));
  });
