import { actorFromRequestHeaders, assertTrustedOrigin, type Actor } from './access';
import { CampaignError } from './rules';

export async function handle(request: Request, action: (actor: Actor) => Promise<Response>) {
  try {
    const actor = await actorFromRequestHeaders(request.headers);
    if (request.method !== 'GET' && request.method !== 'HEAD') assertTrustedOrigin(request);
    return await action(actor);
  } catch (error) {
    if (error instanceof CampaignError) {
      return Response.json(error.field ? { message: error.message, field: error.field } : { message: error.message }, { status: error.status });
    }
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'unknown';
    console.error(`campaign request failed: ${code}`);
    return Response.json({ message: 'Действие не выполнено.' }, { status: 500 });
  }
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export async function campaignId(context: { params: Promise<{ id: string }> }) {
  return (await context.params).id;
}
