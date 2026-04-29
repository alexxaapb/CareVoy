-- CareVoy Supabase Schema
-- Run this in the Supabase SQL editor against your project.

-- =========================================================================
-- Extensions
-- =========================================================================
create extension if not exists "pgcrypto";

-- =========================================================================
-- Tables
-- =========================================================================

-- 1. patients
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text,
  phone text unique,
  email text,
  home_address text,
  date_of_birth date,
  hsa_fsa_card_token text,
  stripe_customer_id text,
  onboarding_complete boolean not null default false,
  emergency_contact_name text,
  emergency_contact_phone text,
  default_mobility_needs text,
  preferred_language text not null default 'en',
  referral_source text
);

-- Migration: add the columns above to an existing patients table.
-- Safe to re-run; uses IF NOT EXISTS.
alter table public.patients
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists default_mobility_needs text,
  add column if not exists preferred_language text not null default 'en',
  add column if not exists referral_source text;

-- 1b. caregivers — adult children / family members booking on behalf of a patient
create table if not exists public.caregivers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  caregiver_user_id uuid not null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  relationship text,
  consent_signed_at timestamptz,
  consent_method text,
  can_book_rides boolean not null default true,
  can_view_receipts boolean not null default true,
  active boolean not null default true,
  unique (caregiver_user_id, patient_id)
);
create index if not exists caregivers_caregiver_user_id_idx
  on public.caregivers (caregiver_user_id) where active;
create index if not exists caregivers_patient_id_idx
  on public.caregivers (patient_id) where active;

-- 2. hospitals
create table if not exists public.hospitals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text,
  address text,
  city text,
  state text,
  contact_email text,
  stripe_subscription_id text,
  tier text not null default 'starter',
  patients_per_month integer not null default 0,
  active boolean not null default true
);

-- 3. hospital_coordinators
create table if not exists public.hospital_coordinators (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  hospital_id uuid references public.hospitals(id) on delete cascade,
  full_name text,
  email text unique,
  phone text
);

-- 4. nemt_partners
create table if not exists public.nemt_partners (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_name text,
  contact_name text,
  contact_phone text,
  contact_email text,
  city text,
  state text,
  api_endpoint text,
  api_key text,
  dispatch_software text,
  active boolean not null default true
);

-- 5. rides
create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  patient_id uuid references public.patients(id) on delete cascade,
  hospital_id uuid references public.hospitals(id) on delete set null,
  nemt_partner_id uuid references public.nemt_partners(id) on delete set null,
  ride_type text check (ride_type in ('pre_op', 'post_op')),
  pickup_address text,
  dropoff_address text,
  pickup_time timestamptz,
  surgery_date date,
  procedure_type text,
  mobility_needs text,
  companion_requested boolean not null default false,
  status text not null default 'pending',
  driver_name text,
  driver_phone text,
  vehicle_type text,
  estimated_cost numeric,
  actual_cost numeric,
  nemt_confirmation_id text,
  tracking_url text,
  driver_lat numeric,
  driver_lng numeric,
  pickup_lat numeric,
  pickup_lng numeric,
  rating integer check (rating between 1 and 5)
);

-- 6. payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ride_id uuid references public.rides(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  amount numeric,
  payment_method text check (payment_method in ('hsa', 'fsa', 'card')),
  stripe_payment_intent_id text,
  flex_transaction_id text,
  status text not null default 'pending',
  receipt_url text,
  hsa_fsa_eligible boolean not null default true,
  irs_expense_code text not null default '213d'
);

-- 7. receipts
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  payment_id uuid references public.payments(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  ride_id uuid references public.rides(id) on delete cascade,
  pdf_url text,
  emailed_at timestamptz,
  provider_name text,
  service_date date,
  service_type text not null default 'Medical Transportation',
  amount numeric,
  irs_code_reference text not null default 'IRS Publication 502 - Transportation'
);

-- 8. notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  recipient_type text check (recipient_type in ('patient', 'coordinator', 'nemt', 'admin')),
  recipient_id uuid,
  channel text check (channel in ('sms', 'email', 'push')),
  message text,
  status text not null default 'pending',
  sent_at timestamptz,
  twilio_sid text
);

-- 9. ai_conversations
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  patient_id uuid references public.patients(id) on delete cascade,
  session_id text,
  status text not null default 'active',
  intent_detected text,
  extraction_complete boolean not null default false,
  extracted_data jsonb,
  ride_booked boolean not null default false,
  ride_id uuid references public.rides(id) on delete set null,
  total_messages integer not null default 0,
  resolved boolean not null default false
);

-- 10. ai_messages
create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  conversation_id uuid references public.ai_conversations(id) on delete cascade,
  role text check (role in ('user', 'assistant')),
  content text,
  tokens_used integer,
  claude_model text,
  intent_signal text
);

-- 11. ai_extractions
create table if not exists public.ai_extractions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  conversation_id uuid references public.ai_conversations(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  surgery_date date,
  surgery_time text,
  hospital_name text,
  hospital_id uuid references public.hospitals(id) on delete set null,
  procedure_type text,
  needs_wheelchair boolean not null default false,
  needs_companion boolean not null default false,
  home_address text,
  special_instructions text,
  confidence_score numeric,
  confirmed_by_patient boolean not null default false,
  extraction_version integer not null default 1
);

-- 12. hsa_fsa_questions
create table if not exists public.hsa_fsa_questions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  conversation_id uuid references public.ai_conversations(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  question text,
  answer text,
  category text check (category in ('eligibility', 'reimbursement', 'card_payment', 'receipt', 'limits')),
  helpful boolean
);

-- staff (NEMT drivers, coordinators, admins)
create table if not exists public.staff (
  id uuid primary key,
  created_at timestamptz not null default now(),
  email text unique,
  full_name text,
  role text check (role in ('nemt', 'coordinator', 'admin')),
  nemt_partner_id uuid references public.nemt_partners(id) on delete set null
);

-- =========================================================================
-- Indexes
-- =========================================================================
create index if not exists idx_staff_partner on public.staff(nemt_partner_id);
create index if not exists idx_rides_patient on public.rides(patient_id);
create index if not exists idx_rides_hospital on public.rides(hospital_id);
create index if not exists idx_payments_patient on public.payments(patient_id);
create index if not exists idx_receipts_patient on public.receipts(patient_id);
create index if not exists idx_ai_conversations_patient on public.ai_conversations(patient_id);
create index if not exists idx_ai_messages_conversation on public.ai_messages(conversation_id);
create index if not exists idx_ai_extractions_conversation on public.ai_extractions(conversation_id);
create index if not exists idx_hsa_fsa_questions_conversation on public.hsa_fsa_questions(conversation_id);
create index if not exists idx_hospital_coordinators_hospital on public.hospital_coordinators(hospital_id);

-- =========================================================================
-- Row Level Security
-- =========================================================================
alter table public.patients enable row level security;
alter table public.hospitals enable row level security;
alter table public.hospital_coordinators enable row level security;
alter table public.nemt_partners enable row level security;
alter table public.rides enable row level security;
alter table public.payments enable row level security;
alter table public.receipts enable row level security;
alter table public.notifications enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_extractions enable row level security;
alter table public.hsa_fsa_questions enable row level security;

-- =========================================================================
-- Policies
-- Assumes patients.id == auth.uid() (Supabase Auth user id)
-- and hospital_coordinators.id == auth.uid() for coordinator users.
-- The service_role key bypasses RLS automatically in Supabase.
-- =========================================================================

-- patients: own row only
drop policy if exists "patients_select_own" on public.patients;
create policy "patients_select_own" on public.patients
  for select using (auth.uid() = id);

drop policy if exists "patients_insert_own" on public.patients;
create policy "patients_insert_own" on public.patients
  for insert with check (auth.uid() = id);

drop policy if exists "patients_update_own" on public.patients;
create policy "patients_update_own" on public.patients
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- rides: patients see only their rides
drop policy if exists "rides_patient_all" on public.rides;
create policy "rides_patient_all" on public.rides
  for all using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

-- payments: patients see only their payments
drop policy if exists "payments_patient_all" on public.payments;
create policy "payments_patient_all" on public.payments
  for all using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

-- receipts: patients see only their receipts
drop policy if exists "receipts_patient_all" on public.receipts;
create policy "receipts_patient_all" on public.receipts
  for all using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

-- ai_conversations: patients see only their conversations
drop policy if exists "ai_conversations_patient_all" on public.ai_conversations;
create policy "ai_conversations_patient_all" on public.ai_conversations
  for all using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

-- ai_messages: patients see only messages in their conversations
drop policy if exists "ai_messages_patient_all" on public.ai_messages;
create policy "ai_messages_patient_all" on public.ai_messages
  for all using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id and c.patient_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id and c.patient_id = auth.uid()
    )
  );

-- ai_extractions: patients see only their extractions
drop policy if exists "ai_extractions_patient_all" on public.ai_extractions;
create policy "ai_extractions_patient_all" on public.ai_extractions
  for all using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

-- hsa_fsa_questions: patients see only their questions
drop policy if exists "hsa_fsa_questions_patient_all" on public.hsa_fsa_questions;
create policy "hsa_fsa_questions_patient_all" on public.hsa_fsa_questions
  for all using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

-- hospital_coordinators: coordinators see only their own row
drop policy if exists "coordinators_select_own" on public.hospital_coordinators;
create policy "coordinators_select_own" on public.hospital_coordinators
  for select using (auth.uid() = id);

drop policy if exists "coordinators_update_own" on public.hospital_coordinators;
create policy "coordinators_update_own" on public.hospital_coordinators
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- hospitals: coordinators see only their hospital
drop policy if exists "hospitals_coordinator_select" on public.hospitals;
create policy "hospitals_coordinator_select" on public.hospitals
  for select using (
    exists (
      select 1 from public.hospital_coordinators hc
      where hc.hospital_id = hospitals.id and hc.id = auth.uid()
    )
  );

-- notifications: recipients can read their own notifications
drop policy if exists "notifications_recipient_select" on public.notifications;
create policy "notifications_recipient_select" on public.notifications
  for select using (auth.uid() = recipient_id);

-- staff: own row only
alter table public.staff enable row level security;

drop policy if exists "staff_select_own" on public.staff;
create policy "staff_select_own" on public.staff
  for select using (auth.uid() = id);

drop policy if exists "staff_update_own" on public.staff;
create policy "staff_update_own" on public.staff
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- rides: NEMT staff can see and update rides assigned to their partner
drop policy if exists "rides_nemt_select" on public.rides;
create policy "rides_nemt_select" on public.rides
  for select using (
    exists (
      select 1 from public.staff s
      where s.id = auth.uid()
        and s.role = 'nemt'
        and s.nemt_partner_id = rides.nemt_partner_id
    )
  );

drop policy if exists "rides_nemt_update" on public.rides;
create policy "rides_nemt_update" on public.rides
  for update using (
    exists (
      select 1 from public.staff s
      where s.id = auth.uid()
        and s.role = 'nemt'
        and s.nemt_partner_id = rides.nemt_partner_id
    )
  );

-- nemt_partners: no public policies (admin/service-role only)

-- =========================================================================
-- Caregivers: RLS + RPC for adding a care recipient atomically
-- =========================================================================
alter table public.caregivers enable row level security;

drop policy if exists "caregivers_select_own" on public.caregivers;
create policy "caregivers_select_own" on public.caregivers
  for select using (auth.uid() = caregiver_user_id);

drop policy if exists "caregivers_update_own" on public.caregivers;
create policy "caregivers_update_own" on public.caregivers
  for update using (auth.uid() = caregiver_user_id)
  with check (auth.uid() = caregiver_user_id);

-- Patients: caregivers can read & update their care recipients in addition
-- to their own row. Replaces the original "own only" select/update policies.
drop policy if exists "patients_select_own" on public.patients;
drop policy if exists "patients_select_own_or_care" on public.patients;
create policy "patients_select_own_or_care" on public.patients
  for select using (
    auth.uid() = id
    or exists (
      select 1 from public.caregivers c
      where c.caregiver_user_id = auth.uid()
        and c.patient_id = patients.id
        and c.active
    )
  );

drop policy if exists "patients_update_own" on public.patients;
drop policy if exists "patients_update_own_or_care" on public.patients;
create policy "patients_update_own_or_care" on public.patients
  for update using (
    auth.uid() = id
    or exists (
      select 1 from public.caregivers c
      where c.caregiver_user_id = auth.uid()
        and c.patient_id = patients.id
        and c.active
    )
  ) with check (true);

-- Rides: caregivers can book/view rides for their care recipients.
drop policy if exists "rides_patient_all" on public.rides;
drop policy if exists "rides_patient_or_caregiver" on public.rides;
create policy "rides_patient_or_caregiver" on public.rides
  for all using (
    auth.uid() = patient_id
    or exists (
      select 1 from public.caregivers c
      where c.caregiver_user_id = auth.uid()
        and c.patient_id = rides.patient_id
        and c.active
        and c.can_book_rides
    )
  ) with check (
    auth.uid() = patient_id
    or exists (
      select 1 from public.caregivers c
      where c.caregiver_user_id = auth.uid()
        and c.patient_id = rides.patient_id
        and c.active
        and c.can_book_rides
    )
  );

-- Receipts: caregivers can view care recipient receipts.
drop policy if exists "receipts_patient_all" on public.receipts;
drop policy if exists "receipts_patient_or_caregiver" on public.receipts;
create policy "receipts_patient_or_caregiver" on public.receipts
  for all using (
    auth.uid() = patient_id
    or exists (
      select 1 from public.caregivers c
      where c.caregiver_user_id = auth.uid()
        and c.patient_id = receipts.patient_id
        and c.active
        and c.can_view_receipts
    )
  ) with check (
    auth.uid() = patient_id
    or exists (
      select 1 from public.caregivers c
      where c.caregiver_user_id = auth.uid()
        and c.patient_id = receipts.patient_id
        and c.active
        and c.can_view_receipts
    )
  );

-- RPC: create a patient row + caregiver link atomically.
-- Runs with security definer so the patient insert isn't blocked by
-- the strict patients_insert_own policy. Returns the new patient_id.
create or replace function public.add_care_recipient(
  p_full_name text,
  p_phone text,
  p_email text,
  p_dob date,
  p_address text,
  p_relationship text,
  p_consent_method text default 'app_checkbox'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caregiver uuid := auth.uid();
  v_patient_id uuid;
begin
  if v_caregiver is null then
    raise exception 'Not authenticated';
  end if;
  if coalesce(p_full_name, '') = '' then
    raise exception 'Full name is required';
  end if;

  insert into public.patients (
    id, full_name, phone, email, date_of_birth, home_address,
    onboarding_complete
  ) values (
    gen_random_uuid(), p_full_name, nullif(p_phone, ''), nullif(p_email, ''),
    p_dob, p_address, true
  ) returning id into v_patient_id;

  insert into public.caregivers (
    caregiver_user_id, patient_id, relationship,
    consent_signed_at, consent_method, active
  ) values (
    v_caregiver, v_patient_id, p_relationship,
    now(), coalesce(p_consent_method, 'app_checkbox'), true
  );

  return v_patient_id;
end;
$$;

revoke all on function public.add_care_recipient(text,text,text,date,text,text,text) from public;
grant execute on function public.add_care_recipient(text,text,text,date,text,text,text) to authenticated;
