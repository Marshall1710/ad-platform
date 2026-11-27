import { expect, test } from 'vitest';
import {
  CampaignError,
  applySettings,
  assertReadyToActivate,
  assertStatusAction,
  parseBidUsd,
  parseClickUrl,
  type CampaignSettings,
} from './rules';

const saved: CampaignSettings = {
  trafficCategory: 'adult',
  paymentModel: 'CPC',
  bidMillis: 1000,
  countries: ['US'],
  devices: ['desktop'],
};

test('accepts both payment boundaries and the 0.001 step', () => {
  expect(parseBidUsd('0.001')).toBe(1);
  expect(parseBidUsd('10.000')).toBe(10_000);
  expect(parseBidUsd('10')).toBe(10_000);
  expect(parseBidUsd('1.5')).toBe(1500);
  expect(parseBidUsd('1.001')).toBe(1001);
});

test('rejects a bid outside the range, with the wrong step, or of the wrong type', () => {
  for (const value of ['0', '0.000', '0.0001', '10.001', '1.0000', '-0.001', '01.000', '1.000 ', 1, '', null]) {
    expect(() => parseBidUsd(value), String(value)).toThrow(CampaignError);
  }
});

test('saves several countries and devices, including empty lists, and keeps the previous value', () => {
  const next = applySettings(saved, { countries: ['US', 'DE', 'JP'], devices: ['mobile', 'desktop'] }, 'created');
  expect(next.countries).toEqual(['US', 'DE', 'JP']);
  expect(next.devices).toEqual(['mobile', 'desktop']);
  expect(saved.countries).toEqual(['US']);
  const cleared = applySettings(saved, { countries: [], devices: [] }, 'paused');
  expect(cleared.countries).toEqual([]);
  expect(cleared.devices).toEqual([]);

  for (const patch of [{ countries: ['ZZ'] }, { countries: ['US', 'US'] }, { devices: ['tablet'] }, { devices: 'desktop' }]) {
    expect(() => applySettings(saved, patch, 'created')).toThrow(CampaignError);
    expect(saved).toEqual({
      trafficCategory: 'adult', paymentModel: 'CPC', bidMillis: 1000, countries: ['US'], devices: ['desktop'],
    });
  }
});

test('accepts both models and rejects an unknown category or model without changing the saved settings', () => {
  expect(applySettings(saved, { payment_model: 'CPM', traffic_category: 'mainstream' }, 'created')).toMatchObject({
    paymentModel: 'CPM', trafficCategory: 'mainstream',
  });
  expect(() => applySettings(saved, { traffic_category: 'display' }, 'paused')).toThrow(/adult или mainstream/);
  expect(() => applySettings(saved, { payment_model: 'CPA' }, 'created')).toThrow(/CPC или CPM/);
  expect(saved.paymentModel).toBe('CPC');
  expect(saved.trafficCategory).toBe('adult');
});

test('active campaign can change the bid and targets, but not the model or category', () => {
  const next = applySettings(saved, { bid_usd: '2.500', countries: [], payment_model: 'CPC' }, 'active');
  expect(next.bidMillis).toBe(2500);
  expect(next.countries).toEqual([]);
  expect(next.paymentModel).toBe('CPC');
  expect(() => applySettings(saved, { payment_model: 'CPM' }, 'active')).toThrow(CampaignError);
  expect(() => applySettings(saved, { traffic_category: 'mainstream' }, 'active')).toThrow(CampaignError);
  expect(() => applySettings(saved, { bid_usd: null }, 'active')).toThrow(CampaignError);
  expect(saved.bidMillis).toBe(1000);
});

test('activation requires category, model, bid and creative, while empty targets remain allowed', () => {
  expect(() => assertReadyToActivate({ ...saved, trafficCategory: null }, true)).toThrow(/категория/);
  expect(() => assertReadyToActivate({ ...saved, paymentModel: null }, true)).toThrow(/модель/);
  expect(() => assertReadyToActivate({ ...saved, bidMillis: null }, true)).toThrow(/ставка/);
  expect(() => assertReadyToActivate(saved, false)).toThrow(/креатив/);
  expect(() => assertReadyToActivate({ ...saved, countries: [], devices: [] }, true)).not.toThrow();
});

test('status actions follow the agreed transitions', () => {
  expect(() => assertStatusAction('created', 'pause')).toThrow(CampaignError);
  expect(() => assertStatusAction('paused', 'pause')).toThrow(CampaignError);
  expect(() => assertStatusAction('active', 'activate')).toThrow(CampaignError);
  expect(() => assertStatusAction('active', 'delete')).toThrow(CampaignError);
  expect(() => assertStatusAction('active', 'edit-creative')).toThrow(CampaignError);
  expect(() => assertStatusAction('created', 'activate')).not.toThrow();
  expect(() => assertStatusAction('paused', 'delete')).not.toThrow();
  expect(() => assertStatusAction('paused', 'edit-creative')).not.toThrow();
});

test('click link must be an absolute http or https url', () => {
  expect(parseClickUrl(' https://example.com/path ')).toBe('https://example.com/path');
  expect(parseClickUrl('http://example.com')).toBe('http://example.com');
  for (const value of ['example.com', '/path', 'javascript:alert(1)', 'ftp://example.com', '']) {
    expect(() => parseClickUrl(value)).toThrow(CampaignError);
  }
});
