import { getMigrations } from "better-auth/db/migration";
import { getAuth, pool } from "../src/lib/auth";

try {
  const migration = await getMigrations(getAuth().options);
  process.stdout.write(await migration.compileMigrations());
} finally {
  await pool.end();
}

