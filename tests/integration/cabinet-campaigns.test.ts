import { afterAll, beforeAll, expect, test } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { crc32 } from 'node:zlib';
import sharp from 'sharp';
import pg from 'pg';

const origin = 'http://127.0.0.1:3000';
const { Pool } = pg;
let container: StartedPostgreSqlContainer;
let databaseUrl = '';
let firstLog = '';
let secondLog = '';
let pool: pg.Pool;
let authRoute: typeof import('../../apps/cabinet/src/app/api/auth/[...all]/route');
let campaignsRoute: typeof import('../../apps/cabinet/src/app/api/campaigns/route');
let campaignRoute: typeof import('../../apps/cabinet/src/app/api/campaigns/[id]/route');
let activateRoute: typeof import('../../apps/cabinet/src/app/api/campaigns/[id]/activate/route');
let pauseRoute: typeof import('../../apps/cabinet/src/app/api/campaigns/[id]/pause/route');
let creativeRoute: typeof import('../../apps/cabinet/src/app/api/campaigns/[id]/creative/route');
let imageRoute: typeof import('../../apps/cabinet/src/app/api/campaigns/[id]/creative/image/route');
let usersRoute: typeof import('../../apps/cabinet/src/app/api/admin/users/route');
let createAdmin: typeof import('../../apps/cabinet/src/lib/create-admin').createAdmin;
let png = Buffer.alloc(0);
let jpeg = Buffer.alloc(0);
let exactPng = Buffer.alloc(0);

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:18-alpine').start();
  databaseUrl = container.getConnectionUri();
  firstLog = migrate(databaseUrl);
  secondLog = migrate(databaseUrl);
  process.env.DATABASE_URL = databaseUrl;
  process.env.BETTER_AUTH_URL = origin;
  process.env.BETTER_AUTH_SECRET = 'test-secret-longer-than-thirty-two-characters';
  authRoute = await import('../../apps/cabinet/src/app/api/auth/[...all]/route');
  campaignsRoute = await import('../../apps/cabinet/src/app/api/campaigns/route');
  campaignRoute = await import('../../apps/cabinet/src/app/api/campaigns/[id]/route');
  activateRoute = await import('../../apps/cabinet/src/app/api/campaigns/[id]/activate/route');
  pauseRoute = await import('../../apps/cabinet/src/app/api/campaigns/[id]/pause/route');
  creativeRoute = await import('../../apps/cabinet/src/app/api/campaigns/[id]/creative/route');
  imageRoute = await import('../../apps/cabinet/src/app/api/campaigns/[id]/creative/image/route');
  usersRoute = await import('../../apps/cabinet/src/app/api/admin/users/route');
  ({ createAdmin } = await import('../../apps/cabinet/src/lib/create-admin'));
  ({ pool } = await import('../../apps/cabinet/src/lib/auth'));
  png = await sharp({ create: { width: 300, height: 250, channels: 3, background: { r: 200, g: 20, b: 40 } } }).png().toBuffer();
  jpeg = await sharp({ create: { width: 300, height: 250, channels: 3, background: { r: 20, g: 40, b: 180 } } }).jpeg().toBuffer();
  exactPng = padPng(png, 1_048_576);
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

function migrate(url: string) {
  return execFileSync(process.execPath, ['apps/cabinet/scripts/migrate.mjs'], {
    env: { ...process.env, DATABASE_URL: url },
    encoding: 'utf8',
  });
}

function padPng(source: Buffer, target: number) {
  const typeAt = source.lastIndexOf(Buffer.from('IEND'));
  const keyword = Buffer.from('Comment\0');
  const data = Buffer.concat([keyword, Buffer.alloc(target - source.length - 12 - keyword.length, 0x61)]);
  const type = Buffer.from('tEXt');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([source.subarray(0, typeAt - 4), length, type, data, checksum, source.subarray(typeAt - 4)]);
}

function cookieFrom(response: Response) {
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  if (cookies.length > 0) return cookies.map((item) => item.split(';')[0]).join('; ');
  return response.headers.get('set-cookie')?.split(';')[0] ?? '';
}

async function signUp(email: string) {
  const response = await authRoute.POST(new Request(`${origin}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ email, password: 'password-123' }),
  }));
  expect(response.status).toBe(200);
  const user = await pool.query('SELECT id FROM "user" WHERE email = $1', [email]);
  return { cookie: cookieFrom(response), id: user.rows[0].id as string, email };
}

async function signIn(email: string) {
  const response = await authRoute.POST(new Request(`${origin}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ email, password: 'password-123' }),
  }));
  expect(response.status).toBe(200);
  return cookieFrom(response);
}

function jsonRequest(method: string, path: string, cookie = '', body?: unknown, requestOrigin = origin) {
  return new Request(`${origin}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(requestOrigin ? { origin: requestOrigin } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function createEmpty(cookie: string, body?: unknown) {
  const response = await campaignsRoute.POST(jsonRequest('POST', '/api/campaigns', cookie, body ?? {}));
  const payload = await response.json();
  return { response, payload };
}

async function patchCampaign(cookie: string, id: string, body: unknown, requestOrigin = origin) {
  return campaignRoute.PATCH(jsonRequest('PATCH', `/api/campaigns/${id}`, cookie, body, requestOrigin), context(id));
}

function creativeRequest(method: string, id: string, cookie: string, fields: Array<{ name: string; value?: string; file?: Buffer; type?: string }>) {
  const boundary = '----cabinetboundary7f3a';
  const chunks: Buffer[] = [];
  for (const field of fields) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if (field.file) {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${field.name}"; filename="banner"\r\nContent-Type: ${field.type ?? 'application/octet-stream'}\r\n\r\n`));
      chunks.push(field.file);
      chunks.push(Buffer.from('\r\n'));
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${field.name}"\r\n\r\n${field.value ?? ''}\r\n`));
    }
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return new Request(`${origin}/api/campaigns/${id}/creative`, {
    method,
    headers: { cookie, origin, 'content-type': `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat(chunks),
  });
}

async function savedBid(id: string) {
  const result = await pool.query('SELECT traffic_category, payment_model, bid_millis, countries, devices, status FROM campaign WHERE campaign_id = $1', [id]);
  return result.rows[0];
}

test('clean database applies auth and campaign migrations once and keeps signup working', async () => {
  expect(firstLog).toContain('Applied migration 001_auth');
  expect(firstLog).toContain('Applied migration 002_campaigns');
  expect(secondLog).toContain('Migration 001_auth already applied');
  expect(secondLog).toContain('Migration 002_campaigns already applied');
  const tables = await pool.query(`SELECT to_regclass('public.campaign') AS campaign, to_regclass('public.creative') AS creative`);
  expect(tables.rows[0]).toEqual({ campaign: 'campaign', creative: 'creative' });
  const advertiser = await signUp('schema-auth@example.com');
  expect(advertiser.id).toBeTruthy();
});

test('database that already has auth receives the campaign schema', async () => {
  const upgrade = await new PostgreSqlContainer('postgres:18-alpine').start();
  const upgradePool = new Pool({ connectionString: upgrade.getConnectionUri() });
  try {
    await upgradePool.query(readFileSync('apps/cabinet/migrations/001_auth.sql', 'utf8'));
    await upgradePool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    await upgradePool.query(`INSERT INTO schema_migrations(version) VALUES ('001_auth')`);
    const missing = await upgradePool.query(`SELECT to_regclass('public.campaign') AS campaign`);
    expect(missing.rows[0].campaign).toBeNull();
    const output = migrate(upgrade.getConnectionUri());
    expect(output).toContain('Migration 001_auth already applied');
    expect(output).toContain('Applied migration 002_campaigns');
    const present = await upgradePool.query(`SELECT to_regclass('public.campaign') AS campaign, to_regclass('public.creative') AS creative`);
    expect(present.rows[0]).toEqual({ campaign: 'campaign', creative: 'creative' });
    const again = migrate(upgrade.getConnectionUri());
    expect(again).toContain('Migration 002_campaigns already applied');
    expect(again).not.toContain('Applied migration 002_campaigns');
  } finally {
    await upgradePool.end();
    await upgrade.stop();
  }
});

test('advertiser creates an empty campaign and keeps valid settings after a rejected change', async () => {
  const owner = await signUp('owner-settings@example.com');
  const created = await createEmpty(owner.cookie);
  expect(created.response.status).toBe(201);
  expect(created.payload.status).toBe('created');
  expect(created.payload.owner_id).toBe(owner.id);
  expect(created.payload.width).toBe(300);
  expect(created.payload.height).toBe(250);
  const id = created.payload.campaign_id as string;
  const listed = await campaignsRoute.GET(jsonRequest('GET', '/api/campaigns', owner.cookie));
  expect(await listed.json()).toEqual({ campaigns: [expect.objectContaining({ campaign_id: id, status: 'created' })] });

  for (const [model, bid, millis] of [['CPC', '0.001', 1], ['CPM', '10.000', 10000]] as const) {
    const saved = await patchCampaign(owner.cookie, id, {
      traffic_category: 'mainstream', payment_model: model, bid_usd: bid, countries: ['US', 'DE'], devices: ['desktop', 'mobile'],
    });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ payment_model: model, bid_usd: bid === '0.001' ? '0.001' : '10.000', status: 'created' });
    expect((await savedBid(id)).bid_millis).toBe(millis);
  }

  const before = await savedBid(id);
  const invalid = await patchCampaign(owner.cookie, id, { traffic_category: 'display', countries: ['US', 'US'], devices: ['tablet'], bid_usd: '10.001' });
  expect(invalid.status).toBe(400);
  expect(await savedBid(id)).toEqual(before);
  const cleared = await patchCampaign(owner.cookie, id, { countries: [], devices: [] });
  expect(cleared.status).toBe(200);
  expect(await cleared.json()).toMatchObject({ countries: [], devices: [] });
});

test('creative can be added with an empty name, replaced once, and is kept when a replacement is invalid', async () => {
  const owner = await signUp('owner-creative@example.com');
  const created = await createEmpty(owner.cookie);
  const id = created.payload.campaign_id as string;
  const added = await creativeRoute.POST(creativeRequest('POST', id, owner.cookie, [
    { name: 'name', value: '' },
    { name: 'click_url', value: 'https://example.com/landing' },
    { name: 'image', file: exactPng, type: 'image/png' },
  ]), context(id));
  expect(added.status).toBe(201);
  expect(await added.json()).toMatchObject({ creative: { name: null, click_url: 'https://example.com/landing', content_type: 'image/png' } });
  const image = await imageRoute.GET(jsonRequest('GET', `/api/campaigns/${id}/creative/image`, owner.cookie), context(id));
  expect(image.status).toBe(200);
  expect(image.headers.get('content-type')).toBe('image/png');
  expect(image.headers.get('cache-control')).toBe('private, no-store');
  expect(Buffer.from(await image.arrayBuffer())).toEqual(exactPng);

  const duplicate = await creativeRoute.POST(creativeRequest('POST', id, owner.cookie, [
    { name: 'click_url', value: 'https://example.com/other' },
    { name: 'image', file: jpeg, type: 'image/jpeg' },
  ]), context(id));
  expect(duplicate.status).toBe(409);
  const replaced = await creativeRoute.PATCH(creativeRequest('PATCH', id, owner.cookie, [
    { name: 'image', file: jpeg, type: 'image/jpeg' },
  ]), context(id));
  expect(replaced.status).toBe(200);
  expect(await replaced.json()).toMatchObject({ creative: { click_url: 'https://example.com/landing', content_type: 'image/jpeg' } });
  const count = await pool.query('SELECT count(*)::int AS count FROM creative WHERE campaign_id = $1', [id]);
  expect(count.rows[0].count).toBe(1);

  const previous = await pool.query('SELECT image, click_url FROM creative WHERE campaign_id = $1', [id]);
  const broken = await creativeRoute.PATCH(creativeRequest('PATCH', id, owner.cookie, [
    { name: 'click_url', value: 'https://example.com/broken' },
    { name: 'image', file: png.subarray(0, 20), type: 'image/png' },
  ]), context(id));
  expect(broken.status).toBe(400);
  const after = await pool.query('SELECT image, click_url FROM creative WHERE campaign_id = $1', [id]);
  expect(after.rows[0].click_url).toBe(previous.rows[0].click_url);
  expect(after.rows[0].image).toEqual(previous.rows[0].image);

  const removed = await creativeRoute.DELETE(jsonRequest('DELETE', `/api/campaigns/${id}/creative`, owner.cookie), context(id));
  expect(removed.status).toBe(204);
  const gone = await pool.query('SELECT count(*)::int AS count FROM creative WHERE campaign_id = $1', [id]);
  expect(gone.rows[0].count).toBe(0);
});

test('campaign moves through created, active, paused and deletion while keeping its owner', async () => {
  const owner = await signUp('owner-lifecycle@example.com');
  const created = await createEmpty(owner.cookie);
  const id = created.payload.campaign_id as string;
  const missingCreative = await activateRoute.POST(jsonRequest('POST', `/api/campaigns/${id}/activate`, owner.cookie), context(id));
  expect(missingCreative.status).toBe(400);
  await creativeRoute.POST(creativeRequest('POST', id, owner.cookie, [
    { name: 'name', value: '   ' },
    { name: 'click_url', value: 'http://example.com/ad' },
    { name: 'image', file: jpeg, type: 'image/jpeg' },
  ]), context(id));
  await patchCampaign(owner.cookie, id, { traffic_category: 'adult', payment_model: 'CPM', bid_usd: '1.000', countries: [], devices: [] });
  const earlyPause = await pauseRoute.POST(jsonRequest('POST', `/api/campaigns/${id}/pause`, owner.cookie), context(id));
  expect(earlyPause.status).toBe(409);
  const activated = await activateRoute.POST(jsonRequest('POST', `/api/campaigns/${id}/activate`, owner.cookie), context(id));
  expect(activated.status).toBe(200);
  expect(await activated.json()).toMatchObject({ status: 'active', creative: { name: null } });
  const repeat = await activateRoute.POST(jsonRequest('POST', `/api/campaigns/${id}/activate`, owner.cookie), context(id));
  expect(repeat.status).toBe(409);
  const modelChange = await patchCampaign(owner.cookie, id, { payment_model: 'CPC' });
  expect(modelChange.status).toBe(409);
  const creativeChange = await creativeRoute.PATCH(creativeRequest('PATCH', id, owner.cookie, [
    { name: 'click_url', value: 'https://example.com/new' },
  ]), context(id));
  expect(creativeChange.status).toBe(409);
  const bidChange = await patchCampaign(owner.cookie, id, { bid_usd: '2.500', countries: ['JP'] });
  expect(bidChange.status).toBe(200);
  expect(await bidChange.json()).toMatchObject({ status: 'active', bid_usd: '2.500', countries: ['JP'] });
  const activeDelete = await campaignRoute.DELETE(jsonRequest('DELETE', `/api/campaigns/${id}`, owner.cookie), context(id));
  expect(activeDelete.status).toBe(409);
  const paused = await pauseRoute.POST(jsonRequest('POST', `/api/campaigns/${id}/pause`, owner.cookie), context(id));
  expect(paused.status).toBe(200);
  expect((await paused.json()).status).toBe('paused');
  const pausedAgain = await pauseRoute.POST(jsonRequest('POST', `/api/campaigns/${id}/pause`, owner.cookie), context(id));
  expect(pausedAgain.status).toBe(409);
  const deleted = await campaignRoute.DELETE(jsonRequest('DELETE', `/api/campaigns/${id}`, owner.cookie), context(id));
  expect(deleted.status).toBe(204);
  const hidden = await campaignRoute.GET(jsonRequest('GET', `/api/campaigns/${id}`, owner.cookie), context(id));
  expect(hidden.status).toBe(404);
  const again = await campaignRoute.DELETE(jsonRequest('DELETE', `/api/campaigns/${id}`, owner.cookie), context(id));
  expect(again.status).toBe(404);
  const link = await pool.query('SELECT owner_id, deleted_at IS NOT NULL AS deleted FROM campaign WHERE campaign_id = $1', [id]);
  expect(link.rows).toEqual([{ owner_id: owner.id, deleted: true }]);
  const visible = await campaignsRoute.GET(jsonRequest('GET', '/api/campaigns', owner.cookie));
  expect(await visible.json()).toEqual({ campaigns: [] });
});

test('administrator manages the selected advertiser and the owner can resume the campaign', async () => {
  const first = await signUp('listed-one@example.com');
  const second = await signUp('listed-two@example.com');
  await createAdmin('cabinet-admin@example.com', 'password-123');
  const adminCookie = await signIn('cabinet-admin@example.com');
  const users = await usersRoute.GET(jsonRequest('GET', '/api/admin/users', adminCookie));
  expect(users.status).toBe(200);
  const userList = (await users.json()).users as Array<{ id: string; email: string; role: string }>;
  expect(userList).toEqual(expect.arrayContaining([
    { id: first.id, email: first.email, role: 'advertiser' },
    { id: second.id, email: second.email, role: 'advertiser' },
    expect.objectContaining({ email: 'cabinet-admin@example.com', role: 'admin' }),
  ]));
  expect(userList.find((user) => user.email === second.email)).not.toHaveProperty('password');
  const empty = await campaignsRoute.GET(jsonRequest('GET', `/api/campaigns?owner_id=${second.id}`, adminCookie));
  expect(await empty.json()).toEqual({ campaigns: [] });

  const created = await createEmpty(adminCookie, { owner_id: second.id });
  expect(created.response.status).toBe(201);
  expect(created.payload.owner_id).toBe(second.id);
  const id = created.payload.campaign_id as string;
  await patchCampaign(adminCookie, id, { traffic_category: 'mainstream', payment_model: 'CPC', bid_usd: '3.000', countries: [], devices: [] });
  await creativeRoute.POST(creativeRequest('POST', id, adminCookie, [
    { name: 'name', value: '' },
    { name: 'click_url', value: 'https://advertiser.example/item' },
    { name: 'image', file: png, type: 'image/png' },
  ]), context(id));
  expect((await activateRoute.POST(jsonRequest('POST', `/api/campaigns/${id}/activate`, adminCookie), context(id))).status).toBe(200);
  expect((await pauseRoute.POST(jsonRequest('POST', `/api/campaigns/${id}/pause`, adminCookie), context(id))).status).toBe(200);
  const ownerView = await campaignRoute.GET(jsonRequest('GET', `/api/campaigns/${id}`, second.cookie), context(id));
  expect(await ownerView.json()).toMatchObject({ status: 'paused', owner_id: second.id });
  const resumed = await activateRoute.POST(jsonRequest('POST', `/api/campaigns/${id}/activate`, second.cookie), context(id));
  expect(resumed.status).toBe(200);
  expect((await resumed.json()).status).toBe('active');
});

test('server rejects another advertiser, a missing session and an untrusted origin without changing data', async () => {
  const owner = await signUp('private-owner@example.com');
  const other = await signUp('private-other@example.com');
  const created = await createEmpty(owner.cookie);
  const id = created.payload.campaign_id as string;
  await creativeRoute.POST(creativeRequest('POST', id, owner.cookie, [
    { name: 'click_url', value: 'https://example.com/private' },
    { name: 'image', file: png, type: 'image/png' },
  ]), context(id));
  for (const response of [
    await campaignRoute.GET(jsonRequest('GET', `/api/campaigns/${id}`, other.cookie), context(id)),
    await campaignRoute.PATCH(jsonRequest('PATCH', `/api/campaigns/${id}`, other.cookie, { bid_usd: '1.000' }), context(id)),
    await campaignRoute.DELETE(jsonRequest('DELETE', `/api/campaigns/${id}`, other.cookie), context(id)),
    await activateRoute.POST(jsonRequest('POST', `/api/campaigns/${id}/activate`, other.cookie), context(id)),
    await pauseRoute.POST(jsonRequest('POST', `/api/campaigns/${id}/pause`, other.cookie), context(id)),
    await imageRoute.GET(jsonRequest('GET', `/api/campaigns/${id}/creative/image`, other.cookie), context(id)),
  ]) expect(response.status).toBe(404);
  const forbiddenUsers = await usersRoute.GET(jsonRequest('GET', '/api/admin/users', other.cookie));
  expect(forbiddenUsers.status).toBe(403);
  const foreignCreate = await createEmpty(other.cookie, { owner_id: owner.id });
  expect(foreignCreate.response.status).toBe(403);
  const anonymous = await campaignsRoute.GET(jsonRequest('GET', '/api/campaigns'));
  expect(anonymous.status).toBe(401);
  const before = await pool.query('SELECT count(*)::int AS count FROM campaign');
  const untrusted = await campaignsRoute.POST(jsonRequest('POST', '/api/campaigns', owner.cookie, {}, 'https://untrusted.example'));
  expect(untrusted.status).toBe(403);
  const after = await pool.query('SELECT count(*)::int AS count FROM campaign');
  expect(after.rows[0].count).toBe(before.rows[0].count);
  const local = await campaignsRoute.POST(jsonRequest('POST', '/api/campaigns', owner.cookie, {}, 'http://localhost:3000'));
  expect(local.status).toBe(201);
});

test('a failed write and two competing activations leave one consistent campaign', async () => {
  const owner = await signUp('owner-failure@example.com');
  const created = await createEmpty(owner.cookie);
  const id = created.payload.campaign_id as string;
  await patchCampaign(owner.cookie, id, { traffic_category: 'adult', payment_model: 'CPC', bid_usd: '1.000', countries: [], devices: [] });
  await creativeRoute.POST(creativeRequest('POST', id, owner.cookie, [
    { name: 'click_url', value: 'https://example.com/fail' },
    { name: 'image', file: png, type: 'image/png' },
  ]), context(id));
  await pool.query(`
    CREATE OR REPLACE FUNCTION fail_campaign_update() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'forced write failure';
    END $$ LANGUAGE plpgsql`);
  await pool.query('CREATE TRIGGER fail_campaign_update BEFORE UPDATE ON campaign FOR EACH ROW EXECUTE FUNCTION fail_campaign_update()');
  try {
    const failed = await patchCampaign(owner.cookie, id, { bid_usd: '4.000' });
    expect(failed.status).toBe(500);
    const body = await failed.json();
    expect(body).toEqual({ message: 'Действие не выполнено.' });
    expect(JSON.stringify(body)).not.toContain('forced');
    expect((await savedBid(id)).bid_millis).toBe(1000);
    const failedDelete = await campaignRoute.DELETE(jsonRequest('DELETE', `/api/campaigns/${id}`, owner.cookie), context(id));
    expect(failedDelete.status).toBe(500);
    const creative = await pool.query('SELECT count(*)::int AS count FROM creative WHERE campaign_id = $1', [id]);
    expect(creative.rows[0].count).toBe(1);
    expect((await savedBid(id)).status).toBe('created');
  } finally {
    await pool.query('DROP TRIGGER IF EXISTS fail_campaign_update ON campaign');
  }
  const [first, second] = await Promise.all([
    activateRoute.POST(jsonRequest('POST', `/api/campaigns/${id}/activate`, owner.cookie), context(id)),
    activateRoute.POST(jsonRequest('POST', `/api/campaigns/${id}/activate`, owner.cookie), context(id)),
  ]);
  expect([first.status, second.status].sort()).toEqual([200, 409]);
  expect((await savedBid(id)).status).toBe('active');
});

test('oversized creative input is rejected before the stored creative changes', async () => {
  const owner = await signUp('owner-size@example.com');
  const created = await createEmpty(owner.cookie);
  const id = created.payload.campaign_id as string;
  const added = await creativeRoute.POST(creativeRequest('POST', id, owner.cookie, [
    { name: 'click_url', value: 'https://example.com/size' },
    { name: 'image', file: png, type: 'image/png' },
  ]), context(id));
  expect(added.status).toBe(201);
  const oversized = padPng(png, 1_048_577);
  const tooLarge = await creativeRoute.PATCH(creativeRequest('PATCH', id, owner.cookie, [
    { name: 'image', file: oversized, type: 'image/png' },
  ]), context(id));
  expect(tooLarge.status).toBe(413);
  const stored = await pool.query('SELECT octet_length(image)::int AS size FROM creative WHERE campaign_id = $1', [id]);
  expect(stored.rows[0].size).toBe(png.length);
  const huge = await creativeRoute.PATCH(creativeRequest('PATCH', id, owner.cookie, [
    { name: 'name', value: 'x'.repeat(2_097_153) },
  ]), context(id));
  expect(huge.status).toBe(413);
  expect((await pool.query('SELECT name FROM creative WHERE campaign_id = $1', [id])).rows[0].name).toBeNull();
});
