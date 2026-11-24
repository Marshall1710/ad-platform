import { afterAll, beforeAll, expect, test } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execFileSync } from 'node:child_process';

let container: StartedPostgreSqlContainer;
let route: typeof import('../../apps/cabinet/src/app/api/auth/[...all]/route');
let pool: (typeof import('../../apps/cabinet/src/lib/auth'))['pool'];
const origin = 'http://127.0.0.1:3000';

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:18-alpine').start();
  process.env.DATABASE_URL = container.getConnectionUri();
  process.env.BETTER_AUTH_URL = origin;
  process.env.BETTER_AUTH_SECRET = 'test-secret-longer-than-thirty-two-characters';
  const migration = 'apps/cabinet/scripts/migrate.mjs';
  const first = execFileSync(process.execPath, [migration], { env: process.env, encoding: 'utf8' });
  const second = execFileSync(process.execPath, [migration], { env: process.env, encoding: 'utf8' });
  expect(first).toContain('Applied migration 001_auth');
  expect(second).toContain('already applied');
  route = await import('../../apps/cabinet/src/app/api/auth/[...all]/route');
  ({ pool } = await import('../../apps/cabinet/src/lib/auth'));
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

function post(path: string, body: object) {
  return route.POST(new Request(`${origin}/api/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  }));
}

test('public signup creates advertiser, session and hashes password', async () => {
  const response = await post('sign-up/email', {
    email: '  Alice@Example.COM  ', password: 'password-123', role: 'admin',
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('set-cookie')).toContain('better-auth.session_token');
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  expect(await response.clone().text()).not.toContain('password-123');
  const user = await pool.query('SELECT email, role FROM "user"');
  expect(user.rows).toEqual([{ email: 'alice@example.com', role: 'advertiser' }]);
  const account = await pool.query('SELECT password FROM account');
  expect(account.rows[0].password).not.toBe('password-123');
  expect(account.rows[0].password).toBeTruthy();
});

test('signup normalizes email and refuses a duplicate', async () => {
  const first = await post('sign-up/email', { email: 'Bob@Example.com', password: 'password-123' });
  expect(first.status).toBe(200);
  const second = await post('sign-up/email', { email: '  bob@EXAMPLE.com ', password: 'password-456' });
  expect(second.status).toBeGreaterThanOrEqual(400);
  const count = await pool.query('SELECT count(*)::int AS count FROM "user" WHERE email = $1', ['bob@example.com']);
  expect(count.rows[0].count).toBe(1);
});

test('invalid email and password length do not create accounts', async () => {
  for (const [email, password] of [
    ['bad-email', 'password-123'],
    ['invalid@example.com', 'short'],
    ['invalid@example.com', 'x'.repeat(129)],
  ]) {
    const response = await post('sign-up/email', { email, password });
    expect(response.status).toBeGreaterThanOrEqual(400);
  }
  const result = await pool.query('SELECT count(*)::int AS count FROM "user" WHERE email = $1', ['invalid@example.com']);
  expect(result.rows[0].count).toBe(0);
});

test('login cookie survives requests and logout invalidates it', async () => {
  await post('sign-up/email', { email: 'login@example.com', password: 'password-123' });
  const wrong = await post('sign-in/email', { email: 'login@example.com', password: 'wrong-password' });
  const missing = await post('sign-in/email', { email: 'missing@example.com', password: 'wrong-password' });
  expect(wrong.status).toBeGreaterThanOrEqual(400);
  expect(missing.status).toBe(wrong.status);
  expect(await missing.json()).toEqual(await wrong.json());
  const login = await post('sign-in/email', { email: ' LOGIN@EXAMPLE.COM ', password: 'password-123' });
  expect(login.status).toBe(200);
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  expect(cookie).toContain('better-auth.session_token=');
  const session = await route.GET(new Request(`${origin}/api/auth/get-session`, { headers: { cookie: cookie! } }));
  expect((await session.json()).user.email).toBe('login@example.com');
  const logout = await route.POST(new Request(`${origin}/api/auth/sign-out`, {
    method: 'POST', headers: { cookie: cookie!, origin },
  }));
  expect(logout.status).toBe(200);
  const after = await route.GET(new Request(`${origin}/api/auth/get-session`, { headers: { cookie: cookie! } }));
  expect(await after.json()).toBeNull();
});

test('session expires within 24 hours and expired database session is refused', async () => {
  const signup = await post('sign-up/email', { email: 'expiry@example.com', password: 'password-123' });
  expect(signup.status).toBe(200);
  const sessions = await pool.query('SELECT id, "expiresAt", "createdAt" FROM session ORDER BY "createdAt" DESC LIMIT 1');
  const session = sessions.rows[0];
  const duration = new Date(session.expiresAt).getTime() - new Date(session.createdAt).getTime();
  expect(duration).toBeGreaterThan(0);
  expect(duration).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);
  await pool.query('UPDATE session SET "expiresAt" = now() - interval \'1 second\' WHERE id = $1', [session.id]);
  const cookie = signup.headers.get('set-cookie')?.split(';')[0];
  const response = await route.GET(new Request(`${origin}/api/auth/get-session`, { headers: { cookie: cookie! } }));
  expect(await response.json()).toBeNull();
});

test('auth route exposes only agreed endpoints', async () => {
  const response = await route.GET(new Request(`${origin}/api/auth/list-users`));
  expect(response.status).toBe(404);
});

test('local admin creation makes admin account without changing duplicate', async () => {
  const { createAdmin } = await import('../../apps/cabinet/src/lib/create-admin');
  await createAdmin(' ADMIN@Example.COM ', 'password-123');
  const first = await pool.query('SELECT email, role FROM "user" WHERE email = $1', ['admin@example.com']);
  expect(first.rows).toEqual([{ email: 'admin@example.com', role: 'admin' }]);
  const adminSessions = await pool.query('SELECT count(*)::int AS count FROM session s JOIN "user" u ON u.id = s."userId" WHERE u.email = $1', ['admin@example.com']);
  expect(adminSessions.rows[0].count).toBe(0);
  await expect(createAdmin('admin@example.com', 'different-123')).rejects.toThrow();
  const after = await pool.query('SELECT count(*)::int AS count FROM "user" WHERE email = $1', ['admin@example.com']);
  expect(after.rows[0].count).toBe(1);
  const login = await post('sign-in/email', { email: 'admin@example.com', password: 'password-123' });
  expect(login.status).toBe(200);
});


test('admin command does not elevate an existing advertiser', async () => {
  await post('sign-up/email', { email: 'existing-advertiser@example.com', password: 'password-123' });
  const { createAdmin } = await import('../../apps/cabinet/src/lib/create-admin');
  await expect(createAdmin('EXISTING-ADVERTISER@example.com', 'different-123')).rejects.toThrow();
  const result = await pool.query('SELECT role FROM "user" WHERE email = $1', ['existing-advertiser@example.com']);
  expect(result.rows).toEqual([{ role: 'advertiser' }]);
});

test('registration accepts localhost Origin through loopback proxy', async () => {
  const response = await route.POST(new Request('http://127.0.0.1:3000/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify({ email: 'localhost-registration@example.com', password: 'password-123' }),
  }));
  expect(response.status).toBe(200);
  const result = await pool.query('SELECT role FROM "user" WHERE email = $1', ['localhost-registration@example.com']);
  expect(result.rows).toEqual([{ role: 'advertiser' }]);
});
