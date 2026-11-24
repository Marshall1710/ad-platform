import { campaignId, handle, json } from '../../../../../lib/campaigns/http';
import { activateCampaign } from '../../../../../lib/campaigns/service';

export const dynamic = 'force-dynamic';

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(request, async (actor) => json(await activateCampaign(actor, await campaignId(context))));
}
