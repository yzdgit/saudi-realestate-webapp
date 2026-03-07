-- 003_public_tables.sql
-- Public query tables for the frontend.

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('aqar', 'bayut', 'dealapp')),
  external_id text not null,
  title text,
  city text,
  district text,
  price numeric,
  area_m2 numeric,
  listed_at timestamptz,
  ingested_at timestamptz not null default now(),
  unique (source, external_id)
);
