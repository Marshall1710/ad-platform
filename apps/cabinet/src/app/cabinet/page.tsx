import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from '../../lib/auth';
import { LogoutButton } from '../../components/logout-button';

export const dynamic = 'force-dynamic';

export default async function CabinetPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  return <main className="auth-card">
    <h1>{session.user.role === 'admin' ? 'Администратор вошёл' : 'Рекламодатель вошёл'}</h1>
    <dl>
      <dt>Email</dt><dd>{session.user.email}</dd>
      <dt>Роль</dt><dd>{session.user.role}</dd>
    </dl>
    <LogoutButton />
  </main>;
}


