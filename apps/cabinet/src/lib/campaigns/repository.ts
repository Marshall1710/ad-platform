import type { PoolClient } from 'pg';
import { pool } from '../auth';
import {
  BANNER_HEIGHT,
  BANNER_WIDTH,
  type CampaignJson,
  type CampaignSettings,
  type CampaignStatus,
  type PaymentModel,
  type TrafficCategory,
  formatBidUsd,
  isCampaignId,
} from './rules';

type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

export type CreativeRecord = {
  name: string | null;
  clickUrl: string;
  contentType: 'image/jpeg' | 'image/png';
};

export type CampaignRecord = CampaignSettings & {
  campaignId: string;
  ownerId: string;
  status: CampaignStatus;
  deletedAt: Date | null;
  creative: CreativeRecord | null;
};

const campaignSelect = `
  select c.campaign_id, c.owner_id, c.status, c.traffic_category, c.payment_model, c.bid_millis,
         c.countries, c.devices, c.deleted_at,
         (cr.campaign_id is not null) as has_creative,
         cr.name as creative_name, cr.click_url, cr.content_type
  from campaign c
  left join creative cr on cr.campaign_id = c.campaign_id
`;

export async function withTransaction<T>(action: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function insertCampaign(ownerId: string) {
  const campaignId = crypto.randomUUID();
  await pool.query(`insert into campaign (campaign_id, owner_id, status) values ($1, $2, 'created')`, [campaignId, ownerId]);
  return findCampaign(pool, campaignId);
}

export async function findCampaign(db: Queryable, campaignId: string) {
  if (!isCampaignId(campaignId)) return null;
  const result = await db.query(`${campaignSelect} where c.campaign_id = $1`, [campaignId]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function lockCampaign(client: PoolClient, campaignId: string) {
  if (!isCampaignId(campaignId)) return null;
  const result = await client.query(`${campaignSelect} where c.campaign_id = $1 for update of c`, [campaignId]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function listCampaignRecords(ownerId: string) {
  const result = await pool.query(
    `${campaignSelect} where c.owner_id = $1 and c.deleted_at is null order by c.created_at asc, c.campaign_id asc`,
    [ownerId],
  );
  return result.rows.map(mapRow);
}

export async function saveSettings(client: PoolClient, campaignId: string, settings: CampaignSettings) {
  await client.query(
    `update campaign
     set traffic_category = $2, payment_model = $3, bid_millis = $4, countries = $5, devices = $6, updated_at = now()
     where campaign_id = $1`,
    [campaignId, settings.trafficCategory, settings.paymentModel, settings.bidMillis, settings.countries, settings.devices],
  );
}

export async function saveStatus(client: PoolClient, campaignId: string, status: CampaignStatus) {
  await client.query(`update campaign set status = $2, updated_at = now() where campaign_id = $1`, [campaignId, status]);
}

export async function markDeleted(client: PoolClient, campaignId: string) {
  await client.query(`update campaign set deleted_at = now(), updated_at = now() where campaign_id = $1`, [campaignId]);
  await client.query(`delete from creative where campaign_id = $1`, [campaignId]);
}

export async function insertCreative(client: PoolClient, campaignId: string, creative: CreativeRecord & { image: Buffer }) {
  await client.query(
    `insert into creative (campaign_id, name, image, content_type, click_url) values ($1, $2, $3, $4, $5)`,
    [campaignId, creative.name, creative.image, creative.contentType, creative.clickUrl],
  );
}

export async function updateCreative(client: PoolClient, campaignId: string, creative: CreativeRecord & { image: Buffer | null }) {
  await client.query(
    `update creative
     set name = $2,
         click_url = $3,
         image = coalesce($4, image),
         content_type = coalesce($5, content_type)
     where campaign_id = $1`,
    [campaignId, creative.name, creative.clickUrl, creative.image, creative.image ? creative.contentType : null],
  );
}

export async function deleteCreative(client: PoolClient, campaignId: string) {
  await client.query(`delete from creative where campaign_id = $1`, [campaignId]);
}

export async function readImage(campaignId: string) {
  const result = await pool.query(`select image, content_type from creative where campaign_id = $1`, [campaignId]);
  const row = result.rows[0] as { image: Buffer; content_type: 'image/jpeg' | 'image/png' } | undefined;
  return row ?? null;
}

export async function findUserRole(userId: string) {
  const result = await pool.query(`select id, email, role from "user" where id = $1`, [userId]);
  return result.rows[0] as { id: string; email: string; role: string } | undefined;
}

export async function listUserRows() {
  const result = await pool.query(`select id, email, role from "user" order by email asc, id asc`);
  return result.rows as { id: string; email: string; role: string }[];
}

export function toCampaignJson(record: CampaignRecord): CampaignJson {
  return {
    campaign_id: record.campaignId,
    owner_id: record.ownerId,
    status: record.status,
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    traffic_category: record.trafficCategory,
    payment_model: record.paymentModel,
    bid_usd: formatBidUsd(record.bidMillis),
    countries: record.countries,
    devices: record.devices,
    creative: record.creative
      ? { name: record.creative.name, click_url: record.creative.clickUrl, content_type: record.creative.contentType }
      : null,
  };
}

function mapRow(row: Record<string, unknown>): CampaignRecord {
  return {
    campaignId: String(row.campaign_id),
    ownerId: String(row.owner_id),
    status: row.status as CampaignRecord['status'],
    trafficCategory: (row.traffic_category ?? null) as TrafficCategory | null,
    paymentModel: (row.payment_model ?? null) as PaymentModel | null,
    bidMillis: row.bid_millis === null || row.bid_millis === undefined ? null : Number(row.bid_millis),
    countries: Array.isArray(row.countries) ? row.countries.map(String) : [],
    devices: Array.isArray(row.devices) ? row.devices.map(String) : [],
    deletedAt: (row.deleted_at as Date | null) ?? null,
    creative: row.has_creative
      ? {
          name: (row.creative_name as string | null) ?? null,
          clickUrl: String(row.click_url),
          contentType: row.content_type as CreativeRecord['contentType'],
        }
      : null,
  };
}
