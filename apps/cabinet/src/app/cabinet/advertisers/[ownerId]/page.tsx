import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CampaignList } from '../../../../components/campaign-list';
import { CreateCampaignButton } from '../../../../components/create-campaign-button';
import { LogoutButton } from '../../../../components/logout-button';
import { pageActor } from '../../../../lib/campaigns/page-actor';
import { CampaignError } from '../../../../lib/campaigns/rules';
import { describeAdvertiser, listCampaigns } from '../../../../lib/campaigns/service';

export const dynamic = 'force-dynamic';

export default async function AdvertiserCampaignsPage({ params }: { params: Promise<{ ownerId: string }> }) {
  const actor = await pageActor();
  if (actor.role !== 'admin') redirect('/cabinet');
  const { ownerId } = await params;
  try {
    const owner = await describeAdvertiser(actor, ownerId);
    const campaigns = await listCampaigns(actor, owner.id);
    return <main className="auth-card cabinet-page">
      <p><Link href="/cabinet">Все пользователи</Link></p>
      <LogoutButton />
      <h1>Кампании рекламодателя</h1>
      <dl>
        <dt>Email</dt><dd>{owner.email}</dd>
        <dt>Роль</dt><dd>{owner.role}</dd>
      </dl>
      <CreateCampaignButton ownerId={owner.id} />
      <CampaignList campaigns={campaigns} />
    </main>;
  } catch (error) {
    if (error instanceof CampaignError && error.status === 404) notFound();
    throw error;
  }
}
