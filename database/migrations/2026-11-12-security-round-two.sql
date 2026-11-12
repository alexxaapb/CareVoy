-- Security round two. Safe to run more than once.

-- 1) Patients can read, add and edit their own payments and receipts, but no longer delete them.
--    (Deleting a payment record would erase the HSA/FSA paper trail. Your server code uses the
--    service key, which is not affected by these rules.)
drop policy if exists "payments_patient_all" on public.payments;
drop policy if exists "payments_patient_select" on public.payments;
drop policy if exists "payments_patient_insert" on public.payments;
drop policy if exists "payments_patient_update" on public.payments;
create policy "payments_patient_select" on public.payments for select using (auth.uid() = patient_id);
create policy "payments_patient_insert" on public.payments for insert with check (auth.uid() = patient_id);
create policy "payments_patient_update" on public.payments for update using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

drop policy if exists "receipts_patient_all" on public.receipts;
drop policy if exists "receipts_patient_select" on public.receipts;
drop policy if exists "receipts_patient_insert" on public.receipts;
drop policy if exists "receipts_patient_update" on public.receipts;
create policy "receipts_patient_select" on public.receipts for select using (auth.uid() = patient_id);
create policy "receipts_patient_insert" on public.receipts for insert with check (auth.uid() = patient_id);
create policy "receipts_patient_update" on public.receipts for update using (auth.uid() = patient_id) with check (auth.uid() = patient_id);

-- 2) Counter used to limit sign-up form, API-key and similar requests.
create table if not exists public.rate_hits (
  id bigserial primary key,
  key text not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_rate_hits_lookup on public.rate_hits (key, action, created_at);
alter table public.rate_hits enable row level security;  -- no policies: only the server can use it
