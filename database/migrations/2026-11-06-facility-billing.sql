-- Facility billing and add-ons.
-- Run once in the Supabase SQL editor. Safe to run twice.
--
-- Why a separate table: add-on access and contract numbers must never be
-- editable from a browser. This table has row level security turned on and
-- NO policies, so only the CareVoy server (service role) and you in the
-- Supabase dashboard can read or write it. Coordinators see their own
-- billing through /api/billing/status.

create table if not exists public.facility_billing (
  hospital_id          uuid primary key references public.hospitals(id) on delete cascade,
  stripe_customer_id   text,
  subscription_status  text,            -- active, trialing, past_due, canceled, etc. (kept in sync by Stripe)
  current_period_end   timestamptz,     -- next renewal date
  addons               text[] not null default '{}',   -- e.g. {ehr_sync,calendar_sync}
  ride_limit           integer,         -- rides included per month in this facility's contract
  monthly_price_cents  integer,         -- contract price, shown on the Billing tab
  contract_start       date,
  contract_end         date,
  updated_at           timestamptz not null default now()
);

alter table public.facility_billing enable row level security;
-- (intentionally no policies)

-- Example of setting up one facility by hand (replace the id and values):
-- insert into public.facility_billing (hospital_id, stripe_customer_id, ride_limit, monthly_price_cents, contract_start, contract_end)
-- values ('00000000-0000-0000-0000-000000000000', 'cus_XXXXXXXX', 75, 89900, '2026-11-01', '2027-10-31')
-- on conflict (hospital_id) do update set
--   stripe_customer_id = excluded.stripe_customer_id, ride_limit = excluded.ride_limit,
--   monthly_price_cents = excluded.monthly_price_cents, contract_start = excluded.contract_start,
--   contract_end = excluded.contract_end, updated_at = now();
