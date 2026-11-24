'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function logout() {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/auth/sign-out', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', credentials: 'same-origin' });
      if (!response.ok) throw new Error('Logout failed');
      router.push('/login');
      router.refresh();
    } catch {
      setError('Не удалось выйти. Попробуйте ещё раз.');
      setPending(false);
    }
  }

  return <div>
    <button type="button" onClick={logout} disabled={pending}>{pending ? 'Выходим…' : 'Выйти'}</button>
    {error && <p role="alert" className="form-error">{error}</p>}
  </div>;
}

