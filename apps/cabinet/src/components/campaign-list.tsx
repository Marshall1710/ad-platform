import Link from 'next/link';
import type { CampaignJson } from '../lib/campaigns/rules';

export function CampaignList({ campaigns }: { campaigns: CampaignJson[] }) {
  if (campaigns.length === 0) return <p>Кампаний пока нет.</p>;
  return <ul className="campaign-list">
    {campaigns.map((campaign) => <li key={campaign.campaign_id}>
      <Link href={`/cabinet/campaigns/${campaign.campaign_id}`}>
        <span>{campaign.campaign_id}</span>
        <span>{campaign.status}</span>
      </Link>
    </li>)}
  </ul>;
}
