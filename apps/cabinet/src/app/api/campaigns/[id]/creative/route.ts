import { readCreativeForm } from '../../../../../lib/campaigns/form';
import { campaignId, handle, json } from '../../../../../lib/campaigns/http';
import { addCreative, removeCreative, replaceCreative } from '../../../../../lib/campaigns/service';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export function POST(request: Request, context: Context) {
  return handle(request, async (actor) => json(await addCreative(actor, await campaignId(context), await readCreativeForm(request)), 201));
}

export function PATCH(request: Request, context: Context) {
  return handle(request, async (actor) => json(await replaceCreative(actor, await campaignId(context), await readCreativeForm(request))));
}

export function DELETE(request: Request, context: Context) {
  return handle(request, async (actor) => {
    await removeCreative(actor, await campaignId(context));
    return new Response(null, { status: 204 });
  });
}
