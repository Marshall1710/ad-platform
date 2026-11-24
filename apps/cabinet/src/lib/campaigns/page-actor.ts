import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { actorFromRequestHeaders } from './access';
import { CampaignError } from './rules';

export async function pageActor() {
  try {
    return await actorFromRequestHeaders(await headers());
  } catch (error) {
    if (error instanceof CampaignError && error.status === 401) redirect('/login');
    throw error;
  }
}
