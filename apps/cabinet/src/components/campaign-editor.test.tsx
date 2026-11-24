// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CampaignEditor } from './campaign-editor';
import type { CampaignJson } from '../lib/campaigns/rules';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const campaign: CampaignJson = {
  campaign_id: '11111111-1111-4111-8111-111111111111',
  owner_id: 'owner',
  status: 'created',
  width: 300,
  height: 250,
  traffic_category: null,
  payment_model: 'CPC',
  bid_usd: null,
  countries: [],
  devices: [],
  creative: null,
};

test('client validation rejects a bid with the wrong step and keeps the entered value', async () => {
  const request = vi.spyOn(globalThis, 'fetch');
  render(<CampaignEditor campaign={campaign} returnTo="/cabinet" />);
  const bid = screen.getByLabelText('Ставка, USD') as HTMLInputElement;
  fireEvent.change(bid, { target: { value: '10.001' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }));
  expect((await screen.findByRole('alert')).textContent).toContain('0.001');
  expect(bid.value).toBe('10.001');
  expect(request).not.toHaveBeenCalled();
});

test('client validation accepts both bid boundaries', async () => {
  const request = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
  render(<CampaignEditor campaign={campaign} returnTo="/cabinet" />);
  fireEvent.change(screen.getByLabelText('Ставка, USD'), { target: { value: '0.001' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }));
  await waitFor(() => expect(request).toHaveBeenCalled());
  expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toMatchObject({ bid_usd: '0.001' });

  fireEvent.change(screen.getByLabelText('Ставка, USD'), { target: { value: '10.000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  expect(JSON.parse(String(request.mock.calls[1][1]?.body))).toMatchObject({ bid_usd: '10.000' });
});
