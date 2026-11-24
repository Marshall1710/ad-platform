import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: url });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(587142901)');
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const version = '001_auth';
  const applied = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
  if (!applied.rowCount) {
    const sql = readFileSync(fileURLToPath(new URL('../migrations/001_auth.sql', import.meta.url)), 'utf8');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [version]);
    console.log(`Applied migration ${version}`);
  } else {
    console.log(`Migration ${version} already applied`);
  }
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
