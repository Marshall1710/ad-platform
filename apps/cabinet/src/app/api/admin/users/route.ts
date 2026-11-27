import { handle, json } from '../../../../lib/campaigns/http';
import { listUsers } from '../../../../lib/campaigns/service';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return handle(request, async (actor) => json({ users: await listUsers(actor) }));
}
