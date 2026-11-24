import { readJson } from '../../../../lib/campaigns/form';
import { campaignId, handle, json } from '../../../../lib/campaigns/http';
import { getCampaign, removeCampaign, updateCampaign } from '../../../../lib/campaigns/service';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export function GET(request: Request, context: Context) {
  return handle(request, async (actor) => json(await getCampaign(actor, await campaignId(context))));
}

export function PATCH(request: Request, context: Context) {
  return handle(request, async (actor) => json(await updateCampaign(actor, await campaignId(context), await readJson(request))));
}

export function DELETE(request: Request, context: Context) {
  return handle(request, async (actor) => {
    await removeCampaign(actor, await campaignId(context));
    return new Response(null, { status: 204 });
  });
}
