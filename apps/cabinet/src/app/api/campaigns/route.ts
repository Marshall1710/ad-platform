import { readJson } from '../../../lib/campaigns/form';
import { handle, json } from '../../../lib/campaigns/http';
import { createCampaign, listCampaigns } from '../../../lib/campaigns/service';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const ownerId = new URL(request.url).searchParams.get('owner_id');
  return handle(request, async (actor) => json({ campaigns: await listCampaigns(actor, ownerId) }));
}

export function POST(request: Request) {
  return handle(request, async (actor) => json(await createCampaign(actor, await readJson(request)), 201));
}
