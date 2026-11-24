import { getAuth } from '../../../../lib/auth';

const allowed = new Set([
  'POST sign-up/email',
  'POST sign-in/email',
  'POST sign-out',
  'GET get-session',
]);

async function handle(request: Request) {
  const prefix = '/api/auth/';
  const path = new URL(request.url).pathname;
  if (!path.startsWith(prefix) || !allowed.has(`${request.method} ${path.slice(prefix.length)}`)) {
    return new Response(null, { status: 404 });
  }

  if (path.endsWith('/email')) {
    let payload: Record<string, unknown>;
    try {
      payload = await request.json();
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid body');
    } catch {
      return Response.json({ message: 'Некорректные данные' }, { status: 400 });
    }
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : payload.email;
    const body = path.endsWith('sign-up/email')
      ? { email, password: payload.password, name: email }
      : { email, password: payload.password };
    request = new Request(request, { body: JSON.stringify(body) });
  }
  return getAuth().handler(request);
}

export const POST = handle;
export const GET = handle;
