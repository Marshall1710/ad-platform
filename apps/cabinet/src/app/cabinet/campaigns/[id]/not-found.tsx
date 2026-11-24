import Link from 'next/link';

export default function CampaignNotFound() {
  return <main className="auth-card">
    <h1>Кампания не найдена</h1>
    <p><Link href="/cabinet">К списку кампаний</Link></p>
  </main>;
}
