'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CreateCampaignButton({ ownerId }: { ownerId?: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function create() {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(ownerId ? { owner_id: ownerId } : {}),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.message ?? 'Действие не выполнено.');
        return;
      }
      router.push(`/cabinet/campaigns/${payload.campaign_id}`);
      router.refresh();
    } catch {
      setError('Действие не выполнено.');
    } finally {
      setPending(false);
    }
  }

  return <div className="editor-actions">
    <button type="button" onClick={create} disabled={pending}>{pending ? 'Создаём…' : 'Создать кампанию'}</button>
    {error && <p role="alert" className="form-error">{error}</p>}
  </div>;
}
