import { createAuth, pool } from './auth';

export async function createAdmin(email: string, password: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const result = await createAuth('admin').api.signUpEmail({
    body: { email: normalized, password, name: normalized },
  });
  const saved = await pool.query('SELECT 1 FROM "user" WHERE id = $1 AND email = $2 AND role = $3', [
    result.user.id, normalized, 'admin',
  ]);
  if (!saved.rowCount) throw new Error('Administrator was not created');
}
