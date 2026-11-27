import { CampaignError } from './rules';
import { getAuth } from '../auth';

export type Actor = { id: string; email: string; role: 'advertiser' | 'admin' };

export function trustedOrigins() {
  const baseURL = process.env.BETTER_AUTH_URL ?? '';
  if (!baseURL) return [];
  const origin = new URL(baseURL);
  const loopbackAlias = new URL(baseURL);
  if (origin.hostname === '127.0.0.1') loopbackAlias.hostname = 'localhost';
  else if (origin.hostname === 'localhost') loopbackAlias.hostname = '127.0.0.1';
  return [...new Set([origin.origin, loopbackAlias.origin])];
}

export function assertTrustedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || !trustedOrigins().includes(origin)) throw new CampaignError(403, 'Запрос отклонён.');
}

export function actorFromUser(user: { id: string; email: string; role?: string | null }): Actor {
  if (user.role !== 'advertiser' && user.role !== 'admin') throw new CampaignError(403, 'Недостаточно прав.');
  return { id: user.id, email: user.email, role: user.role };
}

export async function actorFromRequestHeaders(headerList: Headers) {
  const session = await getAuth().api.getSession({ headers: headerList });
  if (!session?.user) throw new CampaignError(401, 'Нужна действующая сессия.');
  return actorFromUser(session.user);
}
