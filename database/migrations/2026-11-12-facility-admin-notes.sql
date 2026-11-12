-- Private admin notes on a facility (shown only in Admin > Facilities > profile).
-- facility_billing has row level security with no policies, so only the CareVoy server can read or write this.
alter table public.facility_billing add column if not exists admin_notes text;
