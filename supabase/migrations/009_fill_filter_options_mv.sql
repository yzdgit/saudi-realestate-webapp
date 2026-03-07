drop materialized view if exists public.mv_filter_options;

create materialized view public.mv_filter_options as
with active_listings as (
  select *
  from public.listings
  where is_active
)
select
  array['sale', 'rent']::text[] as goal,
  array['monthly', 'quarterly', 'semi', 'annually']::text[] as rent_frequency,
  array[
    'apartment',
    'villa',
    'land',
    'duplex',
    'townhouse',
    'office',
    'shop',
    'warehouse',
    'building',
    'farm',
    'chalet',
    'compound',
    'floor',
    'studio',
    'room',
    'other'
  ]::text[] as property_type,
  array['residential', 'commercial']::text[] as listing_type,
  coalesce(array_agg(distinct region_code order by region_code), '{}'::text[]) as region,
  coalesce(array_agg(distinct city_code order by city_code), '{}'::text[]) as city,
  coalesce(array_agg(distinct district_code order by district_code), '{}'::text[]) as district
from active_listings;

create unique index mv_filter_options_single_row_idx
  on public.mv_filter_options ((1));
