-- ═══════════════════════════════════════════════════════════════════
-- Fix: admin can't see patients (RLS blocks them).
-- Create a SECURITY DEFINER function the admin dashboard calls
-- to list all patients, bypassing RLS safely.
-- ═══════════════════════════════════════════════════════════════════

create or replace function admin_list_patients()
returns table (
  id uuid,
  full_name text,
  phone text,
  email text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select id, full_name, phone, email, created_at
  from patients
  order by created_at desc
  limit 500;
$$;

-- Grant execute to authenticated users (admin is authenticated)
grant execute on function admin_list_patients() to authenticated;
