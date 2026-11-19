-- Pay-to-start plan checkout. Run once in the Supabase SQL editor. Safe to run twice.
-- Needs the facility_billing table from 2026-11-06-facility-billing.sql.
alter table public.facility_billing add column if not exists plan text;                    -- starter, essential, professional
alter table public.facility_billing add column if not exists terms_accepted_at timestamptz; -- when they ticked the terms box at checkout
alter table public.facility_billing add column if not exists terms_accepted_by text;        -- the email they were signed in as
