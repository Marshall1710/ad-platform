import Link from 'next/link';

export default function Home() {
  return <main className="auth-card">
    <h1>Кабинет рекламодателя</h1>
    <p>Управление рекламой начинается с учётной записи.</p>
    <nav aria-label="Доступ в кабинет" className="home-links">
      <Link href="/register">Зарегистрироваться</Link>
      <Link href="/login">Войти</Link>
    </nav>
  </main>;
}
