import type { Actor } from './access';
import { pool } from '../auth';
import { validateCreativeImage } from './creative-image';
import {
  deleteCreative,
  findCampaign,
  findUserRole,
  insertCampaign,
  insertCreative,
  listCampaignRecords,
  listUserRows,
  lockCampaign,
  markDeleted,
  readImage,
  saveSettings,
  saveStatus,
  toCampaignJson,
  updateCreative,
  withTransaction,
  type CampaignRecord,
} from './repository';
import {
  CampaignError,
  applySettings,
  assertReadyToActivate,
  assertStatusAction,
  parseClickUrl,
  parseCreativeName,
  type CampaignSettings,
  type SettingsPatch,
} from './rules';

const blockedPatchKeys = ['status', 'owner_id', 'campaign_id', 'creative'] as const;

export async function listUsers(actor: Actor) {
  if (actor.role !== 'admin') throw new CampaignError(403, 'Недостаточно прав.');
  return listUserRows();
}

export async function listCampaigns(actor: Actor, ownerId: string | null) {
  const owner = await ownerForList(actor, ownerId);
  const records = await listCampaignRecords(owner);
  return records.map(toCampaignJson);
}

export async function createCampaign(actor: Actor, payload: Record<string, unknown>) {
  const ownerId = await resolveOwner(actor, payload);
  const record = await insertCampaign(ownerId);
  if (!record) throw new CampaignError(500, 'Действие не выполнено.');
  return toCampaignJson(record);
}

export async function getCampaign(actor: Actor, campaignId: string) {
  return toCampaignJson(requireVisible(actor, await findCampaign(pool, campaignId)));
}

export async function updateCampaign(actor: Actor, campaignId: string, payload: Record<string, unknown>) {
  for (const key of blockedPatchKeys) {
    if (key in payload) throw new CampaignError(400, 'Это поле нельзя изменить этим запросом.', key);
  }
  const patch: SettingsPatch = {};
  if ('traffic_category' in payload) patch.traffic_category = payload.traffic_category;
  if ('payment_model' in payload) patch.payment_model = payload.payment_model;
  if ('bid_usd' in payload) patch.bid_usd = payload.bid_usd;
  if ('countries' in payload) patch.countries = payload.countries;
  if ('devices' in payload) patch.devices = payload.devices;
  return mutate(actor, campaignId, async (client, current) => {
    const next = applySettings(settingsOf(current), patch, current.status);
    await saveSettings(client, campaignId, next);
  });
}

export async function activateCampaign(actor: Actor, campaignId: string) {
  return mutate(actor, campaignId, async (client, current) => {
    assertStatusAction(current.status, 'activate');
    assertReadyToActivate(settingsOf(current), current.creative !== null);
    await saveStatus(client, campaignId, 'active');
  });
}

export async function pauseCampaign(actor: Actor, campaignId: string) {
  return mutate(actor, campaignId, async (client, current) => {
    assertStatusAction(current.status, 'pause');
    await saveStatus(client, campaignId, 'paused');
  });
}

export async function removeCampaign(actor: Actor, campaignId: string) {
  await withTransaction(async (client) => {
    const current = requireVisible(actor, await lockCampaign(client, campaignId));
    assertStatusAction(current.status, 'delete');
    await markDeleted(client, campaignId);
  });
}

export async function addCreative(actor: Actor, campaignId: string, input: CreativeInput) {
  return mutate(actor, campaignId, async (client, current) => {
    assertStatusAction(current.status, 'edit-creative');
    if (current.creative) throw new CampaignError(409, 'У кампании уже есть креатив.');
    const creative = await creativeFrom(input, null);
    if (!creative.image) throw new CampaignError(400, 'Нужно изображение JPEG или PNG 300×250.', 'image');
    await insertCreative(client, campaignId, { ...creative, image: creative.image });
  });
}

export async function replaceCreative(actor: Actor, campaignId: string, input: CreativeInput) {
  return mutate(actor, campaignId, async (client, current) => {
    assertStatusAction(current.status, 'edit-creative');
    if (!current.creative) throw new CampaignError(404, 'Креатив не найден.');
    const creative = await creativeFrom(input, current.creative);
    await updateCreative(client, campaignId, creative);
  });
}

export async function removeCreative(actor: Actor, campaignId: string) {
  return mutate(actor, campaignId, async (client, current) => {
    assertStatusAction(current.status, 'edit-creative');
    if (!current.creative) throw new CampaignError(404, 'Креатив не найден.');
    await deleteCreative(client, campaignId);
  });
}

export async function openCreativeImage(actor: Actor, campaignId: string) {
  const current = requireVisible(actor, await findCampaign(pool, campaignId));
  if (!current.creative) throw new CampaignError(404, 'Креатив не найден.');
  const image = await readImage(campaignId);
  if (!image) throw new CampaignError(404, 'Креатив не найден.');
  return image;
}

export async function describeAdvertiser(actor: Actor, ownerId: string) {
  if (actor.role !== 'admin') throw new CampaignError(403, 'Недостаточно прав.');
  const user = await findUserRole(ownerId);
  if (!user || user.role !== 'advertiser') throw new CampaignError(404, 'Рекламодатель не найден.');
  return { id: user.id, email: user.email, role: user.role };
}

type CreativeInput = {
  image?: Buffer;
  imageProvided: boolean;
  clickUrl?: string;
  clickProvided: boolean;
  name?: string;
  nameProvided: boolean;
};

async function ownerForList(actor: Actor, ownerId: string | null) {
  if (actor.role === 'advertiser') {
    if (ownerId && ownerId !== actor.id) throw new CampaignError(403, 'Недостаточно прав.');
    return actor.id;
  }
  if (!ownerId) throw new CampaignError(400, 'Выберите рекламодателя.', 'owner_id');
  const advertiser = await describeAdvertiser(actor, ownerId);
  return advertiser.id;
}

async function resolveOwner(actor: Actor, payload: Record<string, unknown>) {
  const specified = 'owner_id' in payload;
  if (actor.role === 'advertiser') {
    if (specified && payload.owner_id !== actor.id) throw new CampaignError(403, 'Недостаточно прав.', 'owner_id');
    return actor.id;
  }
  if (typeof payload.owner_id !== 'string' || payload.owner_id.length === 0) {
    throw new CampaignError(400, 'Выберите рекламодателя.', 'owner_id');
  }
  const advertiser = await describeAdvertiser(actor, payload.owner_id);
  return advertiser.id;
}

async function mutate(actor: Actor, campaignId: string, action: (client: Parameters<typeof lockCampaign>[0], current: CampaignRecord) => Promise<void>) {
  const record = await withTransaction(async (client) => {
    const current = requireVisible(actor, await lockCampaign(client, campaignId));
    await action(client, current);
    return requireVisible(actor, await findCampaign(client, campaignId));
  });
  return toCampaignJson(record);
}

function requireVisible(actor: Actor, record: CampaignRecord | null) {
  if (!record || record.deletedAt || (actor.role === 'advertiser' && record.ownerId !== actor.id)) {
    throw new CampaignError(404, 'Кампания не найдена.');
  }
  return record;
}

function settingsOf(record: CampaignRecord): CampaignSettings {
  return {
    trafficCategory: record.trafficCategory,
    paymentModel: record.paymentModel,
    bidMillis: record.bidMillis,
    countries: record.countries,
    devices: record.devices,
  };
}

async function creativeFrom(input: CreativeInput, current: CampaignRecord['creative']) {
  const contentType = input.imageProvided
    ? await validateCreativeImage(input.image ?? Buffer.alloc(0))
    : current?.contentType;
  if (!contentType) throw new CampaignError(400, 'Нужно изображение JPEG или PNG 300×250.', 'image');
  const clickUrl = input.clickProvided ? parseClickUrl(input.clickUrl) : current?.clickUrl;
  if (!clickUrl) throw new CampaignError(400, 'Нужна абсолютная ссылка http или https.', 'click_url');
  const name = input.nameProvided ? parseCreativeName(input.name) : current?.name ?? null;
  return {
    name,
    clickUrl,
    contentType,
    image: input.imageProvided ? input.image ?? Buffer.alloc(0) : null,
  };
}
