import { campaignId, handle } from '../../../../../../lib/campaigns/http';
import { openCreativeImage } from '../../../../../../lib/campaigns/service';

export const dynamic = 'force-dynamic';

export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(request, async (actor) => {
    const image = await openCreativeImage(actor, await campaignId(context));
    return new Response(new Uint8Array(image.image), {
      headers: { 'content-type': image.content_type, 'cache-control': 'private, no-store' },
    });
  });
}
