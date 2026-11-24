import Link from 'next/link';
import { LogoutButton } from '../../components/logout-button';
import { CampaignList } from '../../components/campaign-list';
import { CreateCampaignButton } from '../../components/create-campaign-button';
import { pageActor } from '../../lib/campaigns/page-actor';
import { listCampaigns, listUsers } from '../../lib/campaigns/service';

export const dynamic = 'force-dynamic';

export default async function CabinetPage() {
  const actor = await pageActor();
  const users = actor.role === 'admin' ? await listUsers(actor) : [];
  const campaigns = actor.role === 'advertiser' ? await listCampaigns(actor, null) : [];

  return <main className="auth-card cabinet-page">
    <h1>{actor.role === 'admin' ? 'Администратор вошёл' : 'Рекламодатель вошёл'}</h1>
    <dl>
      <dt>Email</dt><dd>{actor.email}</dd>
      <dt>Роль</dt><dd>{actor.role}</dd>
    </dl>
    <LogoutButton />
    {actor.role === 'admin' ? <>
      <h2>Пользователи</h2>
      <ul className="user-list">
        {users.map((user) => <li key={user.id}>
          <Link href={`/cabinet/advertisers/${user.id}`}>
            <span>{user.email}</span>
            <span>{user.role}</span>
          </Link>
        </li>)}
      </ul>
    </> : <>
      <h2>Кампании</h2>
      <CreateCampaignButton />
      <CampaignList campaigns={campaigns} />
    </>}
  </main>;
}
