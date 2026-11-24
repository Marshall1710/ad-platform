import Link from 'next/link';
import { AuthForm } from '../../components/auth-form';

export default function LoginPage() {
  return <main className="auth-card">
    <h1>Вход в кабинет</h1>
    <p>Введите email и пароль своей учётной записи.</p>
    <AuthForm mode="login" />
    <p>Нет учётной записи? <Link href="/register">Зарегистрироваться</Link></p>
  </main>;
}
