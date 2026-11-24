import Link from 'next/link';
import { AuthForm } from '../../components/auth-form';

export default function RegisterPage() {
  return <main className="auth-card">
    <h1>Регистрация рекламодателя</h1>
    <p>Создайте учётную запись для доступа к кабинету.</p>
    <AuthForm mode="register" />
    <p>Уже зарегистрированы? <Link href="/login">Войти</Link></p>
  </main>;
}
