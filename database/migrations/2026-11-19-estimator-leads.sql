-- Estimator leads: saves what a facility typed on /estimator once they entered their email,
-- so we can send one "finish your snapshot" reminder if they never pressed Send.
-- Counts and a business contact only. No patient data. Service role only (RLS on, no policies).
create table if not exists public.estimator_leads (
  id uuid primary key default gen_random_uuid(),
  token uuid not null default gen_random_uuid(),      -- used in the resume and unsubscribe links
  email text not null,
  contact_name text,
  facility_name text,
  visit_types text,
  appointments integer,
  pct_commercial numeric,
  pct_medicare numeric,
  pct_medicaid numeric,
  pct_selfpay numeric,
  pct_need_ride numeric,
  status text not null default 'started' check (status in ('started','sent')),
  unsubscribed boolean not null default false,
  reminded_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists estimator_leads_email_key on public.estimator_leads (lower(email));
create unique index if not exists estimator_leads_token_key on public.estimator_leads (token);
alter table public.estimator_leads enable row level security;
