// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { AuthForm } from '../../components/auth-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); push.mockClear(); });

test('registration form sends email and password, then opens cabinet', async () => {
  const request = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
  render(<AuthForm mode="register" />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'Alice@Example.com' } });
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'password-123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/cabinet'));
  expect(request).toHaveBeenCalledWith('/api/auth/sign-up/email', expect.objectContaining({ method: 'POST' }));
});

test('registration displays duplicate error without clearing email', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 422 }));
  render(<AuthForm mode="register" />);
  const email = screen.getByLabelText('Email') as HTMLInputElement;
  fireEvent.change(email, { target: { value: 'existing@example.com' } });
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'password-123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Email уже зарегистрирован');
  expect(email.value).toBe('existing@example.com');
});



test('registration does not call an origin rejection a duplicate email', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 403 }));
  render(<AuthForm mode="register" />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'password-123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Регистрация отклонена');
});

test('registration explains a temporary rate limit', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 429 }));
  render(<AuthForm mode="register" />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'password-123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Слишком много попыток');
});
