-- Calendar Sync: stores each facility's private calendar link (ICS feed).
-- Run once in the Supabase SQL editor. Safe to run twice.
-- Row level security is ON with no policies: only the CareVoy server can read it.
-- CareVoy does not store calendar events, only the link. Events are read live when the coordinator opens Integrations.
create table if not exists public.facility_calendar (
  hospital_id uuid primary key references public.hospitals(id) on delete cascade,
  ics_url     text not null,
  updated_at  timestamptz not null default now()
);
alter table public.facility_calendar enable row level security;
