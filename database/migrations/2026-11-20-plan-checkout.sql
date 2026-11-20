-- Pay-to-start plan checkout. Run once in the Supabase SQL editor. Safe to run twice.
-- Needs the facility_billing table from 2026-11-06-facility-billing.sql.
alter table public.facility_billing add column if not exists plan text;                    -- starter, essential, professional
alter table public.facility_billing add column if not exists terms_accepted_at timestamptz; -- when they ticked the terms box at checkout
alter table public.facility_billing add column if not exists terms_accepted_by text;        -- the email they were signed in as

-- Overage billing: tracks how many overage rides were already sent to Stripe for the current billing period.
alter table public.facility_billing add column if not exists overage_period_start timestamptz;
alter table public.facility_billing add column if not exists overage_reported integer not null default 0;

-- Server-side block: a facility that signed up on its own and has not paid cannot create rides or
-- scheduled appointments, even by calling the database directly. Facilities set up before
-- pay-to-start are never affected (they have no signup_flow marker), and neither are patients.
create or replace function public.hospital_requires_payment(hid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.hospitals h
    where h.id = hid
      and coalesce(h.active, false) = false
      and h.intake_data ->> 'signup_flow' = 'self_serve'
      and not exists (
        select 1 from public.facility_billing b
        where b.hospital_id = h.id and b.subscription_status in ('active', 'trialing', 'past_due')
      )
  );
$$;

do $$
begin
  drop policy if exists "unpaid_self_serve_no_rides" on public.rides;
  create policy "unpaid_self_serve_no_rides" on public.rides
    as restrictive for insert to authenticated
    with check (hospital_id is null or not public.hospital_requires_payment(hospital_id));
exception when undefined_table then null;
end $$;

do $$
begin
  drop policy if exists "unpaid_self_serve_no_appointments" on public.scheduled_appointments;
  create policy "unpaid_self_serve_no_appointments" on public.scheduled_appointments
    as restrictive for insert to authenticated
    with check (hospital_id is null or not public.hospital_requires_payment(hospital_id));
exception when undefined_table then null;
end $$;
