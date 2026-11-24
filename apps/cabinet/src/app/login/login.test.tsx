// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { AuthForm } from '../../components/auth-form';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test('login sends credentials and shows the same error on failed authentication', async () => {
  const request = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));
  render(<AuthForm mode="login" />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'wrong-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Неверный email или пароль.');
  expect(request).toHaveBeenCalledWith('/api/auth/sign-in/email', expect.objectContaining({ method: 'POST' }));
});

test('database outage is not presented as invalid credentials', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }));
  render(<AuthForm mode="login" />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'password-123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Сервис временно недоступен');
});

test('login does not call an origin rejection a wrong password', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 403 }));
  render(<AuthForm mode="login" />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'password-123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Вход отклонён');
});

test('login explains a temporary rate limit', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 429 }));
  render(<AuthForm mode="login" />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'password-123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Слишком много попыток');
});
