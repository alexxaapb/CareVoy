-- API key and webhook per facility. Run once in the Supabase SQL editor. Safe to run twice.
-- Server-only (row level security on, no policies). The API key is stored hashed; the webhook
-- secret is stored so CareVoy can sign messages.
create table if not exists public.facility_api (
  hospital_id     uuid primary key references public.hospitals(id) on delete cascade,
  api_key_hash    text unique,
  api_key_prefix  text,
  webhook_url     text,
  webhook_secret  text,
  events          text[] not null default '{ride_accepted,ride_completed,ride_cancelled,ride_unaccepted}',
  updated_at      timestamptz not null default now()
);
alter table public.facility_api enable row level security;
