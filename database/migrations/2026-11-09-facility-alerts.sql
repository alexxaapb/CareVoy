-- Alerts to Slack, Microsoft Teams and email. Run once in the Supabase SQL editor. Safe to run twice.
-- Row level security is ON with no policies: only the CareVoy server can read it
-- (the links are secrets that let anyone post into a channel).
create table if not exists public.facility_alerts (
  hospital_id        uuid primary key references public.hospitals(id) on delete cascade,
  slack_webhook_url  text,
  teams_webhook_url  text,
  alert_email        text,
  events             text[] not null default '{ride_accepted,ride_completed,ride_cancelled,ride_unaccepted}',
  updated_at         timestamptz not null default now()
);
alter table public.facility_alerts enable row level security;
