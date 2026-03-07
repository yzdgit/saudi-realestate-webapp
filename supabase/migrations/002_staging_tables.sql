-- 002_staging_tables.sql
-- Raw/staging tables populated by edge scrapers.

create table if not exists staging.raw_listings (
  source text not null,
  external_id text not null,
  payload jsonb not null,
  scraped_at timestamptz not null default now(),
  primary key (source, external_id)
);
