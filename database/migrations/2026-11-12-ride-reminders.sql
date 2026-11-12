-- Tracks which ride reminder texts have been sent so each goes out once.
alter table public.rides add column if not exists reminder_day_sent_at timestamptz;
alter table public.rides add column if not exists reminder_hour_sent_at timestamptz;
alter table public.rides add column if not exists driver_on_way_sent_at timestamptz;
