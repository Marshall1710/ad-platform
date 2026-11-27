import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CampaignEditor } from '../../../../components/campaign-editor';
import { LogoutButton } from '../../../../components/logout-button';
import { pageActor } from '../../../../lib/campaigns/page-actor';
import { CampaignError } from '../../../../lib/campaigns/rules';
import { getCampaign } from '../../../../lib/campaigns/service';

export const dynamic = 'force-dynamic';

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await pageActor();
  const { id } = await params;
  try {
    const campaign = await getCampaign(actor, id);
    const returnTo = actor.role === 'admin' ? `/cabinet/advertisers/${campaign.owner_id}` : '/cabinet';
    return <main className="auth-card cabinet-page">
      <p><Link href={returnTo}>К списку кампаний</Link></p>
      <LogoutButton />
      <h1>Кампания</h1>
      <dl>
        <dt>Идентификатор</dt><dd>{campaign.campaign_id}</dd>
        <dt>Статус</dt><dd>{campaign.status}</dd>
        <dt>Формат</dt><dd>{campaign.width}×{campaign.height}</dd>
      </dl>
      <CampaignEditor campaign={campaign} returnTo={returnTo} />
    </main>;
  } catch (error) {
    if (error instanceof CampaignError && error.status === 404) notFound();
    throw error;
  }
}
