-- 007_backend_v1.sql
-- Production-ready Supabase backend v1 for listings/map/analyze at 100K+ scale.

create extension if not exists postgis with schema extensions;
create extension if not exists pg_cron with schema extensions;

create schema if not exists analytics;

drop materialized view if exists public.mv_snapshot_geo_latest;
drop materialized view if exists public.mv_snapshot_global_latest;
drop materialized view if exists public.mv_filter_options;

drop function if exists public.rpc_filter_options();
drop function if exists public.rpc_map_area_stats(jsonb, text, text, text);
drop function if exists public.rpc_map_points(jsonb, jsonb, integer);
drop function if exists public.rpc_geo_rankings(jsonb, text);
drop function if exists public.rpc_listings_stats(jsonb, jsonb);
drop function if exists public.rpc_listings_browse(jsonb, text, integer, integer);
drop function if exists public.refresh_read_models();
drop function if exists public.run_daily_analytics_refresh();
drop function if exists public._filtered_listings(jsonb, jsonb);
drop function if exists public._bounds_to_geom(jsonb);
drop function if exists public._jsonb_text_array(jsonb, text);
drop function if exists analytics.capture_daily_snapshots(date);
drop function if exists public.set_listings_updated_at();
drop function if exists analytics.set_snapshot_global_updated_at();

drop table if exists analytics.snapshot_geo_daily cascade;
drop table if exists analytics.snapshot_global_daily cascade;
drop table if exists public.listings cascade;

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('aqar', 'bayut', 'dealapp')),
  external_id text not null,
  listing_uri text not null,
  goal text not null check (goal in ('sale', 'rent')),
  rent_frequency text check (rent_frequency in ('monthly', 'quarterly', 'semi', 'annually')),
  price numeric(14, 2) not null check (price >= 0),
  area_m2 numeric(12, 2) not null check (area_m2 > 0),
  rooms integer check (rooms is null or rooms >= 0),
  bedrooms integer check (bedrooms is null or bedrooms >= 0),
  bathrooms integer check (bathrooms is null or bathrooms >= 0),
  living_rooms integer check (living_rooms is null or living_rooms >= 0),
  property_type text not null check (
    property_type in (
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
      'other'
    )
  ),
  listing_type text not null check (listing_type in ('residential', 'commercial')),
  region_code text not null,
  city_code text not null,
  district_code text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  geom extensions.geometry(Point, 4326)
    generated always as (extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)) stored,
  price_per_m2 numeric(14, 2)
    generated always as (case when area_m2 > 0 then round(price / area_m2, 2) else null end) stored,
  listed_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true,
  source_payload jsonb,
  unique (source, external_id)
);

create index listings_geom_gist_idx on public.listings using gist (geom);
create index listings_active_goal_type_listed_at_idx on public.listings (is_active, goal, listing_type, listed_at desc);
create index listings_active_region_idx on public.listings (region_code) where is_active;
create index listings_active_city_idx on public.listings (city_code) where is_active;
create index listings_active_district_idx on public.listings (district_code) where is_active;
create index listings_active_price_idx on public.listings (price) where is_active;
create index listings_active_area_idx on public.listings (area_m2) where is_active;
create index listings_active_bedrooms_idx on public.listings (bedrooms) where is_active;
create index listings_active_bathrooms_idx on public.listings (bathrooms) where is_active;
create index listings_active_rooms_idx on public.listings (rooms) where is_active;
create index listings_active_rent_frequency_idx on public.listings (rent_frequency)
  where is_active and goal = 'rent';

create or replace function public.set_listings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_listings_updated_at_trg
before update on public.listings
for each row
execute function public.set_listings_updated_at();

create table analytics.snapshot_global_daily (
  snapshot_date date primary key,
  total_listings integer not null,
  median_price numeric(14, 2) not null,
  mean_price numeric(14, 2) not null,
  min_price numeric(14, 2) not null,
  max_price numeric(14, 2) not null,
  median_price_per_m2 numeric(14, 2) not null,
  mean_price_per_m2 numeric(14, 2) not null,
  min_price_per_m2 numeric(14, 2) not null,
  max_price_per_m2 numeric(14, 2) not null,
  median_area numeric(14, 2) not null,
  mean_area numeric(14, 2) not null,
  min_area numeric(14, 2) not null,
  max_area numeric(14, 2) not null,
  rent_share numeric(8, 6) not null,
  sale_share numeric(8, 6) not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table analytics.snapshot_geo_daily (
  snapshot_date date not null,
  level text not null check (level in ('region', 'city', 'district')),
  code text not null,
  goal text not null check (goal in ('sale', 'rent')),
  listing_type text not null check (listing_type in ('residential', 'commercial')),
  total_listings integer not null,
  median_price numeric(14, 2) not null,
  mean_price numeric(14, 2) not null,
  median_price_per_m2 numeric(14, 2) not null,
  mean_price_per_m2 numeric(14, 2) not null,
  created_at timestamptz not null default now(),
  primary key (snapshot_date, level, code, goal, listing_type)
);

create index snapshot_geo_daily_date_level_idx on analytics.snapshot_geo_daily (snapshot_date, level);
create index snapshot_geo_daily_level_code_idx on analytics.snapshot_geo_daily (level, code);

create or replace function analytics.set_snapshot_global_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_snapshot_global_updated_at_trg
before update on analytics.snapshot_global_daily
for each row
execute function analytics.set_snapshot_global_updated_at();

create or replace function public._jsonb_text_array(p_doc jsonb, p_key text)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(value), '{}'::text[])
  from jsonb_array_elements_text(
    case
      when p_doc ? p_key and jsonb_typeof(p_doc -> p_key) = 'array' then p_doc -> p_key
      else '[]'::jsonb
    end
  ) as t(value);
$$;

create or replace function public._bounds_to_geom(p_bounds jsonb)
returns extensions.geometry
language plpgsql
immutable
as $$
declare
  v_north double precision;
  v_south double precision;
  v_east double precision;
  v_west double precision;
begin
  if p_bounds is null then
    return null;
  end if;

  begin
    v_north := nullif(p_bounds ->> 'north', '')::double precision;
    v_south := nullif(p_bounds ->> 'south', '')::double precision;
    v_east := nullif(p_bounds ->> 'east', '')::double precision;
    v_west := nullif(p_bounds ->> 'west', '')::double precision;
  exception
    when others then
      return null;
  end;

  if v_north is null or v_south is null or v_east is null or v_west is null then
    return null;
  end if;

  if v_north < v_south then
    return null;
  end if;

  return extensions.st_makeenvelope(v_west, v_south, v_east, v_north, 4326);
end;
$$;

create or replace function public._filtered_listings(
  p_filters jsonb default '{}'::jsonb,
  p_bounds jsonb default null
)
returns setof public.listings
language plpgsql
stable
as $$
declare
  v_goal text := nullif(p_filters ->> 'goal', '');
  v_listing_type text := nullif(p_filters ->> 'listing_type', '');
  v_rent_frequency text[] := public._jsonb_text_array(p_filters, 'rent_frequency');
  v_property_type text[] := public._jsonb_text_array(p_filters, 'property_type');
  v_region text[] := public._jsonb_text_array(p_filters, 'region');
  v_city text[] := public._jsonb_text_array(p_filters, 'city');
  v_district text[] := public._jsonb_text_array(p_filters, 'district');
  v_price_min numeric := nullif(p_filters ->> 'price_min', '')::numeric;
  v_price_max numeric := nullif(p_filters ->> 'price_max', '')::numeric;
  v_area_min numeric := nullif(p_filters ->> 'area_min', '')::numeric;
  v_area_max numeric := nullif(p_filters ->> 'area_max', '')::numeric;
  v_bedrooms_min integer := nullif(p_filters ->> 'bedrooms_min', '')::integer;
  v_bathrooms_min integer := nullif(p_filters ->> 'bathrooms_min', '')::integer;
  v_rooms_min integer := nullif(p_filters ->> 'rooms_min', '')::integer;
  v_bounds_geom extensions.geometry := public._bounds_to_geom(p_bounds);
begin
  return query
  select l.*
  from public.listings as l
  where l.is_active
    and (v_goal is null or l.goal = v_goal)
    and (v_listing_type is null or l.listing_type = v_listing_type)
    and (coalesce(cardinality(v_rent_frequency), 0) = 0 or l.rent_frequency = any(v_rent_frequency))
    and (coalesce(cardinality(v_property_type), 0) = 0 or l.property_type = any(v_property_type))
    and (coalesce(cardinality(v_region), 0) = 0 or l.region_code = any(v_region))
    and (coalesce(cardinality(v_city), 0) = 0 or l.city_code = any(v_city))
    and (coalesce(cardinality(v_district), 0) = 0 or l.district_code = any(v_district))
    and (v_price_min is null or l.price >= v_price_min)
    and (v_price_max is null or l.price <= v_price_max)
    and (v_area_min is null or l.area_m2 >= v_area_min)
    and (v_area_max is null or l.area_m2 <= v_area_max)
    and (v_bedrooms_min is null or coalesce(l.bedrooms, 0) >= v_bedrooms_min)
    and (v_bathrooms_min is null or coalesce(l.bathrooms, 0) >= v_bathrooms_min)
    and (v_rooms_min is null or coalesce(l.rooms, 0) >= v_rooms_min)
    and (v_bounds_geom is null or extensions.st_intersects(l.geom, v_bounds_geom));
end;
$$;

create or replace function public.rpc_listings_browse(
  p_filters jsonb default '{}'::jsonb,
  p_sort text default 'newest',
  p_page integer default 1,
  p_page_size integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, analytics, extensions, pg_temp
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 12), 1), 200);
  v_offset integer;
  v_total_items integer := 0;
  v_total_pages integer := 1;
  v_rows jsonb := '[]'::jsonb;
begin
  v_offset := (v_page - 1) * v_page_size;

  with filtered as materialized (
    select *
    from public._filtered_listings(coalesce(p_filters, '{}'::jsonb), null)
  )
  select count(*)::integer
  into v_total_items
  from filtered;

  v_total_pages := greatest(1, ceil(v_total_items::numeric / v_page_size)::integer);
  if v_page > v_total_pages then
    v_page := v_total_pages;
    v_offset := (v_page - 1) * v_page_size;
  end if;

  with filtered as materialized (
    select *
    from public._filtered_listings(coalesce(p_filters, '{}'::jsonb), null)
  ),
  paged as (
    select
      l.id,
      l.source,
      l.external_id,
      l.listing_uri,
      l.goal,
      l.rent_frequency,
      l.price,
      l.area_m2,
      l.rooms,
      l.bedrooms,
      l.bathrooms,
      l.living_rooms,
      l.property_type,
      l.listing_type,
      l.region_code,
      l.city_code,
      l.district_code,
      l.latitude,
      l.longitude,
      l.price_per_m2,
      l.listed_at,
      l.last_seen_at,
      l.is_active
    from filtered as l
    order by
      case when p_sort = 'price_asc' then l.price end asc nulls last,
      case when p_sort = 'price_desc' then l.price end desc nulls last,
      case when p_sort = 'area_asc' then l.area_m2 end asc nulls last,
      case when p_sort = 'area_desc' then l.area_m2 end desc nulls last,
      case when p_sort = 'price_per_m2_asc' then l.price_per_m2 end asc nulls last,
      case when p_sort = 'price_per_m2_desc' then l.price_per_m2 end desc nulls last,
      case when p_sort = 'bedrooms_desc' then l.bedrooms end desc nulls last,
      case when p_sort = 'newest' then l.listed_at end desc nulls last,
      l.id desc
    limit v_page_size
    offset v_offset
  )
  select coalesce(jsonb_agg(to_jsonb(paged)), '[]'::jsonb)
  into v_rows
  from paged;

  return jsonb_build_object(
    'rows', v_rows,
    'total_items', v_total_items,
    'page', v_page,
    'page_size', v_page_size,
    'total_pages', v_total_pages
  );
end;
$$;

create or replace function public.rpc_listings_stats(
  p_filters jsonb default '{}'::jsonb,
  p_bounds jsonb default null
)
returns jsonb
language sql
stable
security definer
set search_path = public, analytics, extensions, pg_temp
as $$
with filtered as materialized (
  select *
  from public._filtered_listings(coalesce(p_filters, '{}'::jsonb), p_bounds)
),
metrics as (
  select
    count(*)::integer as total_listings,
    coalesce(percentile_cont(0.5) within group (order by nullif(price, 0)), 0)::numeric as median_price,
    coalesce(avg(nullif(price, 0)), 0)::numeric as mean_price,
    coalesce(min(nullif(price, 0)), 0)::numeric as min_price,
    coalesce(max(nullif(price, 0)), 0)::numeric as max_price,
    coalesce(percentile_cont(0.5) within group (order by nullif(price_per_m2, 0)), 0)::numeric as median_price_per_m2,
    coalesce(avg(nullif(price_per_m2, 0)), 0)::numeric as mean_price_per_m2,
    coalesce(min(nullif(price_per_m2, 0)), 0)::numeric as min_price_per_m2,
    coalesce(max(nullif(price_per_m2, 0)), 0)::numeric as max_price_per_m2,
    coalesce(percentile_cont(0.5) within group (order by nullif(area_m2, 0)), 0)::numeric as median_area,
    coalesce(avg(nullif(area_m2, 0)), 0)::numeric as mean_area,
    coalesce(min(nullif(area_m2, 0)), 0)::numeric as min_area,
    coalesce(max(nullif(area_m2, 0)), 0)::numeric as max_area,
    coalesce((count(*) filter (where goal = 'rent'))::numeric / nullif(count(*)::numeric, 0), 0) as rent_share,
    coalesce((count(*) filter (where goal = 'sale'))::numeric / nullif(count(*)::numeric, 0), 0) as sale_share
  from filtered
),
goal_distribution as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object('key', goal, 'label', goal, 'value', total)
      order by ord
    ),
    '[]'::jsonb
  ) as data
  from (
    select
      goal,
      count(*)::integer as total,
      case goal when 'sale' then 1 when 'rent' then 2 else 99 end as ord
    from filtered
    group by goal
  ) goals
),
property_mix as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'propertyType', property_type,
        'sale', sale_count,
        'rent', rent_count
      )
      order by (sale_count + rent_count) desc
    ),
    '[]'::jsonb
  ) as data
  from (
    select
      property_type,
      count(*) filter (where goal = 'sale')::integer as sale_count,
      count(*) filter (where goal = 'rent')::integer as rent_count
    from filtered
    group by property_type
  ) mix
),
city_distribution as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object('key', city_code, 'label', city_code, 'value', total)
      order by total desc
    ),
    '[]'::jsonb
  ) as data
  from (
    select city_code, count(*)::integer as total
    from filtered
    group by city_code
    order by total desc
    limit 12
  ) city_rows
),
district_avg as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object('districtCode', district_code, 'value', value)
      order by value desc
    ),
    '[]'::jsonb
  ) as data
  from (
    select
      district_code,
      avg(price_per_m2)::numeric as value
    from filtered
    where price_per_m2 > 0
    group by district_code
    order by value desc
    limit 12
  ) district_rows
),
price_span as (
  select min(price)::numeric as min_price, max(price)::numeric as max_price
  from filtered
  where price > 0
),
area_span as (
  select min(area_m2)::numeric as min_area, max(area_m2)::numeric as max_area
  from filtered
  where area_m2 > 0
),
price_histogram as (
  select case
    when ps.min_price is null then '[]'::jsonb
    when ps.min_price = ps.max_price then jsonb_build_array(
      jsonb_build_object(
        'range', round(ps.min_price)::text,
        'count', (select count(*)::integer from filtered where price > 0)
      )
    )
    else (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'range',
            concat(
              round(ps.min_price + ((b.bucket - 1)::numeric * (ps.max_price - ps.min_price) / 8.0)),
              '-',
              round(ps.min_price + (b.bucket::numeric * (ps.max_price - ps.min_price) / 8.0))
            ),
            'count',
            b.bucket_count
          )
          order by b.bucket
        ),
        '[]'::jsonb
      )
      from (
        select
          least(8, greatest(1, width_bucket(f.price, ps.min_price, ps.max_price, 8)))::integer as bucket,
          count(*)::integer as bucket_count
        from filtered as f
        where f.price > 0
        group by 1
      ) as b
    )
  end as data
  from price_span as ps
),
area_histogram as (
  select case
    when aspan.min_area is null then '[]'::jsonb
    when aspan.min_area = aspan.max_area then jsonb_build_array(
      jsonb_build_object(
        'range', round(aspan.min_area)::text,
        'count', (select count(*)::integer from filtered where area_m2 > 0)
      )
    )
    else (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'range',
            concat(
              round(aspan.min_area + ((b.bucket - 1)::numeric * (aspan.max_area - aspan.min_area) / 8.0)),
              '-',
              round(aspan.min_area + (b.bucket::numeric * (aspan.max_area - aspan.min_area) / 8.0))
            ),
            'count',
            b.bucket_count
          )
          order by b.bucket
        ),
        '[]'::jsonb
      )
      from (
        select
          least(8, greatest(1, width_bucket(f.area_m2, aspan.min_area, aspan.max_area, 8)))::integer as bucket,
          count(*)::integer as bucket_count
        from filtered as f
        where f.area_m2 > 0
        group by 1
      ) as b
    )
  end as data
  from area_span as aspan
),
scatter_sample as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sampled.id::text,
        'source', sampled.source,
        'area', sampled.area_m2,
        'price', sampled.price,
        'price_per_m2', sampled.price_per_m2
      )
      order by sampled.sample_key
    ),
    '[]'::jsonb
  ) as data
  from (
    select
      id,
      source,
      area_m2,
      price,
      price_per_m2,
      md5(id::text) as sample_key
    from filtered
    where price > 0 and area_m2 > 0
    order by sample_key
    limit 2000
  ) sampled
),
city_geo as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'cityCode', city_code,
        'count', total,
        'avgPricePerM2', avg_price_per_m2,
        'latitude', avg_latitude,
        'longitude', avg_longitude
      )
      order by total desc
    ),
    '[]'::jsonb
  ) as data
  from (
    select
      city_code,
      count(*)::integer as total,
      coalesce(avg(nullif(price_per_m2, 0)), 0)::numeric as avg_price_per_m2,
      avg(latitude)::double precision as avg_latitude,
      avg(longitude)::double precision as avg_longitude
    from filtered
    group by city_code
    order by total desc
  ) city_geo_rows
)
select jsonb_build_object(
  'totalListings', metrics.total_listings,
  'medianPrice', metrics.median_price,
  'meanPrice', metrics.mean_price,
  'minPrice', metrics.min_price,
  'maxPrice', metrics.max_price,
  'medianPricePerM2', metrics.median_price_per_m2,
  'meanPricePerM2', metrics.mean_price_per_m2,
  'minPricePerM2', metrics.min_price_per_m2,
  'maxPricePerM2', metrics.max_price_per_m2,
  'medianArea', metrics.median_area,
  'meanArea', metrics.mean_area,
  'minArea', metrics.min_area,
  'maxArea', metrics.max_area,
  'rentShare', metrics.rent_share,
  'saleShare', metrics.sale_share,
  'goalDistribution', goal_distribution.data,
  'propertyTypeByGoal', property_mix.data,
  'cityDistribution', city_distribution.data,
  'districtAvgPricePerM2', district_avg.data,
  'priceHistogram', price_histogram.data,
  'areaHistogram', area_histogram.data,
  'scatter', scatter_sample.data,
  'cityGeo', city_geo.data
)
from metrics
cross join goal_distribution
cross join property_mix
cross join city_distribution
cross join district_avg
cross join price_histogram
cross join area_histogram
cross join scatter_sample
cross join city_geo;
$$;

create or replace function public.rpc_geo_rankings(
  p_filters jsonb default '{}'::jsonb,
  p_level text default 'region'
)
returns jsonb
language sql
stable
security definer
set search_path = public, analytics, extensions, pg_temp
as $$
with filtered as materialized (
  select *
  from public._filtered_listings(coalesce(p_filters, '{}'::jsonb), null)
),
grouped as (
  select
    case
      when p_level = 'region' then region_code
      when p_level = 'city' then city_code
      when p_level = 'district' then district_code
      else null
    end as code,
    count(*)::integer as count,
    coalesce(avg(nullif(price, 0)), 0)::numeric as mean_price,
    coalesce(percentile_cont(0.5) within group (order by nullif(price, 0)), 0)::numeric as median_price,
    coalesce(avg(nullif(price_per_m2, 0)), 0)::numeric as mean_price_per_m2,
    coalesce(percentile_cont(0.5) within group (order by nullif(price_per_m2, 0)), 0)::numeric as median_price_per_m2,
    coalesce((count(*) filter (where goal = 'rent'))::numeric / nullif(count(*)::numeric, 0), 0) as rent_share,
    coalesce((count(*) filter (where goal = 'sale'))::numeric / nullif(count(*)::numeric, 0), 0) as sale_share
  from filtered
  group by 1
)
select case
  when p_level not in ('region', 'city', 'district') then '[]'::jsonb
  else coalesce(
    jsonb_agg(
      jsonb_build_object(
        'code', code,
        'level', p_level,
        'count', count,
        'meanPrice', mean_price,
        'medianPrice', median_price,
        'meanPricePerM2', mean_price_per_m2,
        'medianPricePerM2', median_price_per_m2,
        'rentShare', rent_share,
        'saleShare', sale_share
      )
      order by count desc
    ),
    '[]'::jsonb
  )
end
from grouped
where code is not null and code <> '';
$$;

create or replace function public.rpc_map_points(
  p_filters jsonb default '{}'::jsonb,
  p_bounds jsonb default null,
  p_limit integer default 500
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, analytics, extensions, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 500), 1), 500);
  v_total_in_bounds integer := 0;
  v_rows jsonb := '[]'::jsonb;
begin
  with filtered as materialized (
    select *
    from public._filtered_listings(coalesce(p_filters, '{}'::jsonb), p_bounds)
  )
  select count(*)::integer
  into v_total_in_bounds
  from filtered;

  with filtered as materialized (
    select *
    from public._filtered_listings(coalesce(p_filters, '{}'::jsonb), p_bounds)
  ),
  limited as (
    select
      id,
      source,
      external_id,
      listing_uri,
      goal,
      rent_frequency,
      price,
      area_m2,
      rooms,
      bedrooms,
      bathrooms,
      living_rooms,
      property_type,
      listing_type,
      region_code,
      city_code,
      district_code,
      latitude,
      longitude,
      price_per_m2,
      listed_at,
      last_seen_at,
      is_active
    from filtered
    order by listed_at desc nulls last, id desc
    limit v_limit
  )
  select coalesce(jsonb_agg(to_jsonb(limited)), '[]'::jsonb)
  into v_rows
  from limited;

  return jsonb_build_object(
    'rows', v_rows,
    'returned_count', coalesce(jsonb_array_length(v_rows), 0),
    'total_in_bounds', v_total_in_bounds
  );
end;
$$;

create or replace function public.rpc_map_area_stats(
  p_filters jsonb default '{}'::jsonb,
  p_level text default 'region',
  p_region_code text default null,
  p_city_code text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public, analytics, extensions, pg_temp
as $$
with filtered as materialized (
  select *
  from public._filtered_listings(coalesce(p_filters, '{}'::jsonb), null)
  where (p_level <> 'city' or p_region_code is null or region_code = p_region_code)
    and (p_level <> 'district' or p_region_code is null or region_code = p_region_code)
    and (p_level <> 'district' or p_city_code is null or city_code = p_city_code)
),
grouped as (
  select
    case
      when p_level = 'region' then region_code
      when p_level = 'city' then city_code
      when p_level = 'district' then district_code
      else null
    end as code,
    count(*)::integer as total_listings,
    coalesce(avg(nullif(price, 0)), 0)::numeric as mean_price,
    coalesce(percentile_cont(0.5) within group (order by nullif(price, 0)), 0)::numeric as median_price,
    coalesce(avg(nullif(price_per_m2, 0)), 0)::numeric as mean_price_per_m2,
    coalesce(percentile_cont(0.5) within group (order by nullif(price_per_m2, 0)), 0)::numeric as median_price_per_m2,
    coalesce((count(*) filter (where goal = 'rent'))::numeric / nullif(count(*)::numeric, 0), 0) as rent_share,
    coalesce((count(*) filter (where goal = 'sale'))::numeric / nullif(count(*)::numeric, 0), 0) as sale_share
  from filtered
  group by 1
)
select case
  when p_level not in ('region', 'city', 'district') then '[]'::jsonb
  else coalesce(
    jsonb_agg(
      jsonb_build_object(
        'level', p_level,
        'code', code,
        'totalListings', total_listings,
        'meanPrice', mean_price,
        'medianPrice', median_price,
        'meanPricePerM2', mean_price_per_m2,
        'medianPricePerM2', median_price_per_m2,
        'rentShare', rent_share,
        'saleShare', sale_share
      )
      order by total_listings desc
    ),
    '[]'::jsonb
  )
end
from grouped
where code is not null and code <> '';
$$;

create materialized view public.mv_filter_options as
select
  coalesce(array_agg(distinct goal order by goal), '{}'::text[]) as goal,
  coalesce(array_agg(distinct rent_frequency order by rent_frequency)
    filter (where rent_frequency is not null), '{}'::text[]) as rent_frequency,
  coalesce(array_agg(distinct property_type order by property_type), '{}'::text[]) as property_type,
  coalesce(array_agg(distinct listing_type order by listing_type), '{}'::text[]) as listing_type,
  coalesce(array_agg(distinct region_code order by region_code), '{}'::text[]) as region,
  coalesce(array_agg(distinct city_code order by city_code), '{}'::text[]) as city,
  coalesce(array_agg(distinct district_code order by district_code), '{}'::text[]) as district
from public.listings
where is_active;

create unique index mv_filter_options_single_row_idx on public.mv_filter_options ((1));

create materialized view public.mv_snapshot_global_latest as
select *
from analytics.snapshot_global_daily
order by snapshot_date desc
limit 1;

create unique index mv_snapshot_global_latest_single_row_idx on public.mv_snapshot_global_latest ((1));

create materialized view public.mv_snapshot_geo_latest as
with latest as (
  select max(snapshot_date) as snapshot_date
  from analytics.snapshot_geo_daily
)
select g.*
from analytics.snapshot_geo_daily as g
join latest as l on l.snapshot_date = g.snapshot_date;

create unique index mv_snapshot_geo_latest_unique_idx
  on public.mv_snapshot_geo_latest (snapshot_date, level, code, goal, listing_type);

create or replace function public.rpc_filter_options()
returns jsonb
language sql
stable
security definer
set search_path = public, analytics, extensions, pg_temp
as $$
select coalesce(to_jsonb(options), '{}'::jsonb)
from public.mv_filter_options as options
limit 1;
$$;

create or replace function analytics.capture_daily_snapshots(
  p_snapshot_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public, analytics, extensions, pg_temp
as $$
declare
  v_stats jsonb;
begin
  v_stats := public.rpc_listings_stats('{}'::jsonb, null);

  insert into analytics.snapshot_global_daily (
    snapshot_date,
    total_listings,
    median_price,
    mean_price,
    min_price,
    max_price,
    median_price_per_m2,
    mean_price_per_m2,
    min_price_per_m2,
    max_price_per_m2,
    median_area,
    mean_area,
    min_area,
    max_area,
    rent_share,
    sale_share,
    payload,
    updated_at
  )
  values (
    p_snapshot_date,
    coalesce((v_stats ->> 'totalListings')::integer, 0),
    coalesce((v_stats ->> 'medianPrice')::numeric, 0),
    coalesce((v_stats ->> 'meanPrice')::numeric, 0),
    coalesce((v_stats ->> 'minPrice')::numeric, 0),
    coalesce((v_stats ->> 'maxPrice')::numeric, 0),
    coalesce((v_stats ->> 'medianPricePerM2')::numeric, 0),
    coalesce((v_stats ->> 'meanPricePerM2')::numeric, 0),
    coalesce((v_stats ->> 'minPricePerM2')::numeric, 0),
    coalesce((v_stats ->> 'maxPricePerM2')::numeric, 0),
    coalesce((v_stats ->> 'medianArea')::numeric, 0),
    coalesce((v_stats ->> 'meanArea')::numeric, 0),
    coalesce((v_stats ->> 'minArea')::numeric, 0),
    coalesce((v_stats ->> 'maxArea')::numeric, 0),
    coalesce((v_stats ->> 'rentShare')::numeric, 0),
    coalesce((v_stats ->> 'saleShare')::numeric, 0),
    coalesce(v_stats, '{}'::jsonb),
    now()
  )
  on conflict (snapshot_date) do update
    set total_listings = excluded.total_listings,
        median_price = excluded.median_price,
        mean_price = excluded.mean_price,
        min_price = excluded.min_price,
        max_price = excluded.max_price,
        median_price_per_m2 = excluded.median_price_per_m2,
        mean_price_per_m2 = excluded.mean_price_per_m2,
        min_price_per_m2 = excluded.min_price_per_m2,
        max_price_per_m2 = excluded.max_price_per_m2,
        median_area = excluded.median_area,
        mean_area = excluded.mean_area,
        min_area = excluded.min_area,
        max_area = excluded.max_area,
        rent_share = excluded.rent_share,
        sale_share = excluded.sale_share,
        payload = excluded.payload,
        updated_at = now();

  delete from analytics.snapshot_geo_daily
  where snapshot_date = p_snapshot_date;

  insert into analytics.snapshot_geo_daily (
    snapshot_date,
    level,
    code,
    goal,
    listing_type,
    total_listings,
    median_price,
    mean_price,
    median_price_per_m2,
    mean_price_per_m2
  )
  select
    p_snapshot_date,
    src.level,
    src.code,
    src.goal,
    src.listing_type,
    count(*)::integer as total_listings,
    coalesce(percentile_cont(0.5) within group (order by nullif(src.price, 0)), 0)::numeric as median_price,
    coalesce(avg(nullif(src.price, 0)), 0)::numeric as mean_price,
    coalesce(percentile_cont(0.5) within group (order by nullif(src.price_per_m2, 0)), 0)::numeric as median_price_per_m2,
    coalesce(avg(nullif(src.price_per_m2, 0)), 0)::numeric as mean_price_per_m2
  from (
    select 'region'::text as level, region_code as code, goal, listing_type, price, price_per_m2
    from public.listings
    where is_active
    union all
    select 'city'::text as level, city_code as code, goal, listing_type, price, price_per_m2
    from public.listings
    where is_active
    union all
    select 'district'::text as level, district_code as code, goal, listing_type, price, price_per_m2
    from public.listings
    where is_active
  ) as src
  where src.code is not null and src.code <> ''
  group by src.level, src.code, src.goal, src.listing_type;
end;
$$;

create or replace function public.refresh_read_models()
returns void
language plpgsql
security definer
set search_path = public, analytics, extensions, pg_temp
as $$
begin
  refresh materialized view public.mv_filter_options;
  refresh materialized view public.mv_snapshot_global_latest;
  refresh materialized view public.mv_snapshot_geo_latest;
end;
$$;

create or replace function public.run_daily_analytics_refresh()
returns void
language plpgsql
security definer
set search_path = public, analytics, extensions, pg_temp
as $$
begin
  perform analytics.capture_daily_snapshots((now() at time zone 'Asia/Riyadh')::date);
  perform public.refresh_read_models();
end;
$$;

do $$
declare
  v_job_id bigint;
begin
  begin
    select jobid
    into v_job_id
    from cron.job
    where jobname = 'daily-analytics-refresh'
    limit 1;

    if v_job_id is not null then
      perform cron.unschedule(v_job_id);
    end if;

    perform cron.schedule(
      'daily-analytics-refresh',
      '5 21 * * *',
      $cron$select public.run_daily_analytics_refresh();$cron$
    );
  exception
    when undefined_table then
      raise notice 'pg_cron not available; skipping cron schedule setup';
  end;
end;
$$;

alter table public.listings enable row level security;
alter table analytics.snapshot_global_daily enable row level security;
alter table analytics.snapshot_geo_daily enable row level security;

drop policy if exists "Public read listings" on public.listings;
create policy "Public read listings"
on public.listings
for select
to anon, authenticated
using (true);

drop policy if exists "Service role manage listings" on public.listings;
create policy "Service role manage listings"
on public.listings
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role snapshot_global access" on analytics.snapshot_global_daily;
create policy "Service role snapshot_global access"
on analytics.snapshot_global_daily
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role snapshot_geo access" on analytics.snapshot_geo_daily;
create policy "Service role snapshot_geo access"
on analytics.snapshot_geo_daily
for all
to service_role
using (true)
with check (true);

revoke all on table public.listings from anon, authenticated;
revoke all on table analytics.snapshot_global_daily from anon, authenticated;
revoke all on table analytics.snapshot_geo_daily from anon, authenticated;

revoke all on function public._jsonb_text_array(jsonb, text) from public, anon, authenticated;
revoke all on function public._bounds_to_geom(jsonb) from public, anon, authenticated;
revoke all on function public._filtered_listings(jsonb, jsonb) from public, anon, authenticated;

revoke all on function public.rpc_listings_browse(jsonb, text, integer, integer) from public;
revoke all on function public.rpc_listings_stats(jsonb, jsonb) from public;
revoke all on function public.rpc_geo_rankings(jsonb, text) from public;
revoke all on function public.rpc_map_points(jsonb, jsonb, integer) from public;
revoke all on function public.rpc_map_area_stats(jsonb, text, text, text) from public;
revoke all on function public.rpc_filter_options() from public;
revoke all on function public.refresh_read_models() from public;
revoke all on function public.run_daily_analytics_refresh() from public;
revoke all on function analytics.capture_daily_snapshots(date) from public;

grant execute on function public.rpc_listings_browse(jsonb, text, integer, integer) to anon, authenticated;
grant execute on function public.rpc_listings_stats(jsonb, jsonb) to anon, authenticated;
grant execute on function public.rpc_geo_rankings(jsonb, text) to anon, authenticated;
grant execute on function public.rpc_map_points(jsonb, jsonb, integer) to anon, authenticated;
grant execute on function public.rpc_map_area_stats(jsonb, text, text, text) to anon, authenticated;
grant execute on function public.rpc_filter_options() to anon, authenticated;
grant execute on function public.refresh_read_models() to service_role;
grant execute on function public.run_daily_analytics_refresh() to service_role;
grant execute on function analytics.capture_daily_snapshots(date) to service_role;

select public.refresh_read_models();
