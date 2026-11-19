-- Practice confirms the visit happened; the receipt then shows who confirmed it and when.
alter table public.rides add column if not exists visit_confirmed_at timestamptz;
alter table public.rides add column if not exists visit_confirmed_by text;
