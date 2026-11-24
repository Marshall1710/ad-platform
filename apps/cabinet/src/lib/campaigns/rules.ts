export const COUNTRIES = ['US', 'CA', 'BR', 'GB', 'DE', 'FR', 'ES', 'RU', 'IN', 'JP'] as const;
export const DEVICES = ['desktop', 'mobile'] as const;
export const TRAFFIC_CATEGORIES = ['adult', 'mainstream'] as const;
export const PAYMENT_MODELS = ['CPC', 'CPM'] as const;
export const BANNER_WIDTH = 300;
export const BANNER_HEIGHT = 250;
export const MIN_BID_MILLIS = 1;
export const MAX_BID_MILLIS = 10_000;
export const MAX_IMAGE_BYTES = 1_048_576;
export const MAX_CREATIVE_BODY_BYTES = 2_097_152;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BID_PATTERN = /^(?:0|[1-9]\d?)(?:\.\d{1,3})?$/;

export class CampaignError extends Error {
  readonly status: number;
  readonly field?: string;

  constructor(status: number, message: string, field?: string) {
    super(message);
    this.name = 'CampaignError';
    this.status = status;
    this.field = field;
  }
}

export type TrafficCategory = (typeof TRAFFIC_CATEGORIES)[number];
export type PaymentModel = (typeof PAYMENT_MODELS)[number];
export type CampaignStatus = 'created' | 'active' | 'paused';

export type CampaignSettings = {
  trafficCategory: TrafficCategory | null;
  paymentModel: PaymentModel | null;
  bidMillis: number | null;
  countries: string[];
  devices: string[];
};

export type SettingsPatch = {
  traffic_category?: unknown;
  payment_model?: unknown;
  bid_usd?: unknown;
  countries?: unknown;
  devices?: unknown;
};

export type CampaignJson = {
  campaign_id: string;
  owner_id: string;
  status: CampaignStatus;
  width: number;
  height: number;
  traffic_category: TrafficCategory | null;
  payment_model: PaymentModel | null;
  bid_usd: string | null;
  countries: string[];
  devices: string[];
  creative: null | {
    name: string | null;
    click_url: string;
    content_type: 'image/jpeg' | 'image/png';
  };
};

export function isCampaignId(value: string) {
  return UUID_PATTERN.test(value);
}

export function formatBidUsd(millis: number | null) {
  if (millis === null) return null;
  return `${Math.trunc(millis / 1000)}.${String(millis % 1000).padStart(3, '0')}`;
}

export function parseBidUsd(value: unknown) {
  if (typeof value !== 'string' || value !== value.trim() || !BID_PATTERN.test(value)) {
    throw bidError();
  }
  const [whole, fraction = ''] = value.split('.');
  const millis = Number(whole) * 1000 + Number(fraction.padEnd(3, '0'));
  if (!Number.isSafeInteger(millis) || millis < MIN_BID_MILLIS || millis > MAX_BID_MILLIS) throw bidError();
  return millis;
}

export function applySettings(current: CampaignSettings, patch: SettingsPatch, status: CampaignStatus) {
  const next: CampaignSettings = {
    ...current,
    countries: [...current.countries],
    devices: [...current.devices],
  };
  if ('traffic_category' in patch) {
    const category = parseChoice(patch.traffic_category, TRAFFIC_CATEGORIES, 'traffic_category', 'Категория трафика должна быть adult или mainstream.');
    if (status === 'active' && category !== current.trafficCategory) {
      throw new CampaignError(409, 'У активной кампании нельзя менять категорию трафика.', 'traffic_category');
    }
    next.trafficCategory = category;
  }
  if ('payment_model' in patch) {
    const model = parseChoice(patch.payment_model, PAYMENT_MODELS, 'payment_model', 'Модель оплаты должна быть CPC или CPM.');
    if (status === 'active' && model !== current.paymentModel) {
      throw new CampaignError(409, 'У активной кампании нельзя менять модель оплаты.', 'payment_model');
    }
    next.paymentModel = model;
  }
  if ('bid_usd' in patch) {
    if (patch.bid_usd === null) {
      if (status === 'active') throw new CampaignError(409, 'У активной кампании нужна допустимая ставка.', 'bid_usd');
      next.bidMillis = null;
    } else {
      next.bidMillis = parseBidUsd(patch.bid_usd);
    }
  }
  if ('countries' in patch) next.countries = parseList(patch.countries, COUNTRIES, 'countries', 'Страна должна быть из согласованного перечня.');
  if ('devices' in patch) next.devices = parseList(patch.devices, DEVICES, 'devices', 'Устройство должно быть desktop или mobile.');
  return next;
}

export function assertReadyToActivate(settings: CampaignSettings, hasCreative: boolean) {
  if (!settings.trafficCategory) throw new CampaignError(400, 'Для включения нужна категория трафика.', 'traffic_category');
  if (!settings.paymentModel) throw new CampaignError(400, 'Для включения нужна модель оплаты.', 'payment_model');
  if (settings.bidMillis === null) throw new CampaignError(400, 'Для включения нужна допустимая ставка.', 'bid_usd');
  if (!hasCreative) throw new CampaignError(400, 'Для включения нужен креатив с изображением и ссылкой.', 'creative');
}

export function assertStatusAction(status: CampaignStatus, action: 'activate' | 'pause' | 'delete' | 'edit-creative') {
  if (action === 'activate' && status === 'active') throw new CampaignError(409, 'Кампания уже включена.');
  if (action === 'pause' && status !== 'active') throw new CampaignError(409, 'Пауза доступна только для активной кампании.');
  if (action === 'delete' && status === 'active') throw new CampaignError(409, 'Активную кампанию сначала поставьте на паузу.');
  if (action === 'edit-creative' && status === 'active') throw new CampaignError(409, 'Креатив активной кампании нельзя менять.');
}

export function parseClickUrl(value: unknown) {
  if (typeof value !== 'string') throw urlError();
  const trimmed = value.trim();
  if (!trimmed) throw urlError();
  try {
    const url = new URL(trimmed);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) throw urlError();
  } catch (error) {
    if (error instanceof CampaignError) throw error;
    throw urlError();
  }
  return trimmed;
}

export function parseCreativeName(value: unknown) {
  if (typeof value !== 'string') throw new CampaignError(400, 'Название креатива указано неверно.', 'name');
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function bidError() {
  return new CampaignError(400, 'Ставка должна быть суммой в USD от 0.001 до 10.000 с шагом 0.001.', 'bid_usd');
}

function urlError() {
  return new CampaignError(400, 'Нужна абсолютная ссылка http или https.', 'click_url');
}

function parseChoice<T extends string>(value: unknown, allowed: readonly T[], field: string, message: string) {
  if (value === null) return null;
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new CampaignError(400, message, field);
  return value as T;
}

function parseList(value: unknown, allowed: readonly string[], field: string, message: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new CampaignError(400, message, field);
  if (new Set(value).size !== value.length || value.some((item) => !allowed.includes(item))) {
    throw new CampaignError(400, message, field);
  }
  return [...value];
}
