-- Which EHR each facility uses. Run once in the Supabase SQL editor. Safe to run twice.
-- Needs the facility_billing table from 2026-11-06-facility-billing.sql.
alter table public.facility_billing add column if not exists ehr_system text;       -- 'athenahealth' (more later: 'epic', ...)
alter table public.facility_billing add column if not exists ehr_practice_id text;  -- the facility's practice id inside that EHR

-- Example (replace the id and practice id):
-- update public.facility_billing set ehr_system = 'athenahealth', ehr_practice_id = '195900'
-- where hospital_id = '00000000-0000-0000-0000-000000000000';
