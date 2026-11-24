'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function AuthForm({ mode }: { mode: 'register' | 'login' }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const register = mode === 'register';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const response = await fetch(register ? '/api/auth/sign-up/email' : '/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      if (!response.ok) {
        if (response.status === 429) {
          setError('Слишком много попыток. Подождите немного и попробуйте снова.');
        } else if (response.status === 403) {
          setError(register
            ? 'Регистрация отклонена. Проверьте адрес кабинета и попробуйте снова.'
            : 'Вход отклонён. Проверьте адрес кабинета и попробуйте снова.');
        } else if (response.status >= 500) {
          setError('Сервис временно недоступен. Попробуйте позже.');
        } else if (register && response.status === 422) {
          setError('Email уже зарегистрирован.');
        } else if (register) {
          setError('Проверьте email и пароль.');
        } else {
          setError('Неверный email или пароль.');
        }
        return;
      }
      router.push('/cabinet');
      router.refresh();
    } catch {
      setError('Сервис временно недоступен. Попробуйте позже.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="auth-form">
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" required value={email}
        onChange={(event) => setEmail(event.target.value)} />
      <label htmlFor="password">Пароль</label>
      <input id="password" name="password" type="password" required minLength={8} maxLength={128}
        autoComplete={register ? 'new-password' : 'current-password'} value={password}
        onChange={(event) => setPassword(event.target.value)} />
      {error && <p role="alert" className="form-error">{error}</p>}
      <button type="submit" disabled={pending}>{pending ? 'Подождите…' : register ? 'Зарегистрироваться' : 'Войти'}</button>
    </form>
  );
}


