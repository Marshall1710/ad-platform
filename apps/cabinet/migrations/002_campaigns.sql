create table campaign (
  campaign_id uuid primary key,
  owner_id text not null references "user" (id),
  status text not null,
  traffic_category text,
  payment_model text,
  bid_millis integer,
  countries text[] not null default '{}',
  devices text[] not null default '{}',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_status_check check (status in ('created', 'active', 'paused')),
  constraint campaign_category_check check (traffic_category is null or traffic_category in ('adult', 'mainstream')),
  constraint campaign_model_check check (payment_model is null or payment_model in ('CPC', 'CPM')),
  constraint campaign_bid_check check (bid_millis is null or (bid_millis between 1 and 10000)),
  constraint campaign_countries_check check (countries <@ array['US', 'CA', 'BR', 'GB', 'DE', 'FR', 'ES', 'RU', 'IN', 'JP']::text[]),
  constraint campaign_devices_check check (devices <@ array['desktop', 'mobile']::text[]),
  constraint campaign_active_ready_check check (
    status <> 'active' or (traffic_category is not null and payment_model is not null and bid_millis is not null)
  )
);

create index campaign_owner_id_idx on campaign (owner_id);

create table creative (
  campaign_id uuid primary key references campaign (campaign_id),
  name text,
  image bytea not null,
  content_type text not null,
  click_url text not null,
  constraint creative_type_check check (content_type in ('image/jpeg', 'image/png'))
);
