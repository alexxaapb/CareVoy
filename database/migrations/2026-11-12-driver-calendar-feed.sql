-- Secret link for each NEMT company's calendar feed of accepted rides.
-- Row level security is ON with NO policies, so only the CareVoy server can read or write it.
create table if not exists public.nemt_calendar_tokens (
  nemt_partner_id uuid primary key references public.nemt_partners(id) on delete cascade,
  token           text not null unique,
  created_at      timestamptz not null default now()
);
alter table public.nemt_calendar_tokens enable row level security;
