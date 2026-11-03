-- Qurana diagnostic: the table that keeps every diagnostic result (and later its booking).
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- The server writes with the service key (SUPABASE_SERVICE_KEY), which bypasses Row Level Security.
-- RLS is on with no policies, so the public (anon) key can read or write nothing here.

create table if not exists public.diagnoses (
  id          text primary key check (id ~ '^[a-z0-9]{10}$'),
  created_at  timestamptz not null default now(),
  market      text not null check (market in ('kuwait', 'gulf', 'international')),
  answers     jsonb not null,           -- { profile, stages, suggestion } as the result page needs them; no phone, email or surname
  level       text not null check (level in ('R1', 'R2', 'R3', 'R4', 'R5', 'R6')),
  plan        jsonb,                    -- the notes written for the plan, per language and curriculum version
  status      text not null default 'new' check (status in ('new', 'booked', 'cancelled')),
  booked_at   timestamptz
);

create index if not exists diagnoses_created_at_idx on public.diagnoses (created_at desc);
create index if not exists diagnoses_market_status_idx on public.diagnoses (market, status);

alter table public.diagnoses enable row level security;

-- Teachers who asked to hear when the teachers' diagnostic opens (the "coming soon" page). Email only.
create table if not exists public.waitlist (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  email       text not null check (char_length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role        text not null default 'teacher' check (role in ('teacher')),
  lang        text not null default 'ar' check (lang in ('ar', 'en'))
);

alter table public.waitlist enable row level security;

-- Permissions for the server (service_role) only. Newer Supabase projects do not grant tables made in the
-- SQL Editor to the API roles, and the server then gets "permission denied for table diagnoses".
-- Nothing is granted to anon or authenticated: the public key still reads and writes nothing.
grant usage on schema public to service_role;
grant select, insert, update on public.diagnoses to service_role;
grant select, insert on public.waitlist to service_role;
grant usage, select on all sequences in schema public to service_role;
