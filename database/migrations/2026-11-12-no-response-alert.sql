-- Remembers that a "patient has not confirmed" alert was already sent, so each ride alerts once.
alter table public.rides add column if not exists no_response_alert_sent_at timestamptz;
