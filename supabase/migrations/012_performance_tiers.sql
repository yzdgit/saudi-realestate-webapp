-- 012_performance_tiers.sql
-- Live tier: listings rows/points + KPI live.
-- Daily tier: snapshot-backed analytics and bundled geo area stats.

-- New daily tier objects ------------------------------------------------------

drop function if exists public.rpc_kpi_live(jsonb, jsonb);
drop function if exists public.rpc_kpi_daily(jsonb);
drop function if exists public.rpc_map_area_stats_daily_bundle(jsonb);
drop function if exists public.rpc_analyze_snapshot_daily(jsonb);
drop function if exists public._filtered_snapshot_listings_daily(jsonb);
drop function if exists public._latest_snapshot_date();
drop function if exists analytics.capture_daily_listing_snapshots(date);

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'analytics'
      and table_name = 'snapshot_listings_daily'
  ) then
    create table analytics.snapshot_listings_daily (
      snapshot_date date not null,
      listing_id uuid not null,
      source text not null check (source in ('aqar', 'bayut', 'dealapp')),
      goal text not null check (goal in ('sale', 'rent')),
      rent_frequency text check (rent_frequency in ('monthly', 'quarterly', 'semi', 'annually')),
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
          'room',
          'other'
        )
      ),
      listing_type text not null check (listing_type in ('residential', 'commercial')),
      region_code text not null,
      city_code text not null,
      district_code text not null,
      price numeric(14, 2) not null,
      area_m2 numeric(12, 2) not null,
      price_per_m2 numeric(14, 2),
      latitude double precision not null,
      longitude double precision not null,
      listed_at timestamptz,
      primary key (snapshot_date, listing_id)
    );
  end if;
end;
$$;

create index if not exists snapshot_listings_daily_snapshot_idx
  on analytics.snapshot_listings_daily (snapshot_date desc);

create index if not exists snapshot_listings_daily_snapshot_goal_type_idx
  on analytics.snapshot_listings_daily (snapshot_date, goal, listing_type);

create index if not exists snapshot_listings_daily_snapshot_geo_idx
  on analytics.snapshot_listings_daily (snapshot_date, region_code, city_code, district_code);

create index if not exists snapshot_listings_daily_snapshot_property_idx
  on analytics.snapshot_listings_daily (snapshot_date, property_type, rent_frequency);

alter table analytics.snapshot_listings_daily enable row level security;

drop policy if exists "Service role snapshot_listings access" on analytics.snapshot_listings_daily;
create policy "Service role snapshot_listings access"
on analytics.snapshot_listings_daily
for all
to service_role
using (true)
with check (true);

create or replace function analytics.capture_daily_listing_snapshots(
  p_snapshot_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public, analytics, extensions, pg_temp
as $$
begin
  delete from analytics.snapshot_listings_daily
  where snapshot_date = p_snapshot_date;

  insert into analytics.snapshot_listings_daily (
    snapshot_date,
    listing_id,
    source,
    goal,
    rent_frequency,
    property_type,
    listing_type,
    region_code,
    city_code,
    district_code,
    price,
    area_m2,
    price_per_m2,
    latitude,
    longitude,
    listed_at
  )
  select
    p_snapshot_date,
    l.id,
    l.source,
    l.goal,
    l.rent_frequency,
    l.property_type,
    l.listing_type,
    l.region_code,
    l.city_code,
    l.district_code,
    l.price,
    l.area_m2,
    l.price_per_m2,
    l.latitude,
    l.longitude,
    l.listed_at
  from public.listings as l
  where l.is_active;
end;
$$;

create or replace function public._latest_snapshot_date()
returns date
language sql
stable
as $$
  select max(snapshot_date)
  from analytics.snapshot_listings_daily;
$$;

create or replace function public._filtered_snapshot_listings_daily(
  p_filters jsonb default '{}'::jsonb
)
returns setof analytics.snapshot_listings_daily
language plpgsql
stable
security definer
set search_path = public, analytics, extensions, pg_temp
as $$
declare
  v_snapshot_date date := public._latest_snapshot_date();
  v_goal text := nullif(p_filters ->> 'goal', '');
  v_listing_type text := nullif(p_filters ->> 'listing_type', '');
  v_rent_frequency text[] := public._jsonb_text_array(p_filters, 'rent_frequency');
  v_property_type text[] := public._jsonb_text_array(p_filters, 'property_type');
  v_region text[] := public._jsonb_text_array(p_filters, 'region');
  v_city text[] := public._jsonb_text_array(p_filters, 'city');
  v_district text[] := public._jsonb_text_array(p_filters, 'district');
begin
  if v_snapshot_date is null then
    return;
  end if;

  return query
  select s.*
  from analytics.snapshot_listings_daily as s
  where s.snapshot_date = v_snapshot_date
    and (v_goal is null or s.goal = v_goal)
    and (v_listing_type is null or s.listing_type = v_listing_type)
    and (coalesce(cardinality(v_rent_frequency), 0) = 0 or s.rent_frequency = any(v_rent_frequency))
    and (coalesce(cardinality(v_property_type), 0) = 0 or s.property_type = any(v_property_type))
    and (coalesce(cardinality(v_region), 0) = 0 or s.region_code = any(v_region))
    and (coalesce(cardinality(v_city), 0) = 0 or s.city_code = any(v_city))
    and (coalesce(cardinality(v_district), 0) = 0 or s.district_code = any(v_district));
end;
$$;

create or replace function public.rpc_kpi_live(
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
  'saleShare', metrics.sale_share
)
from metrics;
$$;

create or replace function public.rpc_kpi_daily(
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language sql
stable
security definer
set search_path = public, analytics, extensions, pg_temp
as $$
with filtered as materialized (
  select *
  from public._filtered_snapshot_listings_daily(coalesce(p_filters, '{}'::jsonb))
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
  'saleShare', metrics.sale_share
)
from metrics;
$$;

create or replace function public.rpc_map_area_stats_daily_bundle(
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language sql
stable
security definer
set search_path = public, analytics, extensions, pg_temp
as $$
with filtered as materialized (
  select *
  from public._filtered_snapshot_listings_daily(coalesce(p_filters, '{}'::jsonb))
),
region_rows as (
  select
    region_code as code,
    count(*)::integer as total_listings,
    coalesce(avg(nullif(price, 0)), 0)::numeric as mean_price,
    coalesce(percentile_cont(0.5) within group (order by nullif(price, 0)), 0)::numeric as median_price,
    coalesce(avg(nullif(price_per_m2, 0)), 0)::numeric as mean_price_per_m2,
    coalesce(percentile_cont(0.5) within group (order by nullif(price_per_m2, 0)), 0)::numeric as median_price_per_m2,
    coalesce((count(*) filter (where goal = 'rent'))::numeric / nullif(count(*)::numeric, 0), 0) as rent_share,
    coalesce((count(*) filter (where goal = 'sale'))::numeric / nullif(count(*)::numeric, 0), 0) as sale_share
  from filtered
  group by region_code
),
city_rows as (
  select
    city_code as code,
    count(*)::integer as total_listings,
    coalesce(avg(nullif(price, 0)), 0)::numeric as mean_price,
    coalesce(percentile_cont(0.5) within group (order by nullif(price, 0)), 0)::numeric as median_price,
    coalesce(avg(nullif(price_per_m2, 0)), 0)::numeric as mean_price_per_m2,
    coalesce(percentile_cont(0.5) within group (order by nullif(price_per_m2, 0)), 0)::numeric as median_price_per_m2,
    coalesce((count(*) filter (where goal = 'rent'))::numeric / nullif(count(*)::numeric, 0), 0) as rent_share,
    coalesce((count(*) filter (where goal = 'sale'))::numeric / nullif(count(*)::numeric, 0), 0) as sale_share
  from filtered
  group by city_code
),
district_rows as (
  select
    district_code as code,
    count(*)::integer as total_listings,
    coalesce(avg(nullif(price, 0)), 0)::numeric as mean_price,
    coalesce(percentile_cont(0.5) within group (order by nullif(price, 0)), 0)::numeric as median_price,
    coalesce(avg(nullif(price_per_m2, 0)), 0)::numeric as mean_price_per_m2,
    coalesce(percentile_cont(0.5) within group (order by nullif(price_per_m2, 0)), 0)::numeric as median_price_per_m2,
    coalesce((count(*) filter (where goal = 'rent'))::numeric / nullif(count(*)::numeric, 0), 0) as rent_share,
    coalesce((count(*) filter (where goal = 'sale'))::numeric / nullif(count(*)::numeric, 0), 0) as sale_share
  from filtered
  group by district_code
)
select jsonb_build_object(
  'region',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'level', 'region',
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
      )
      from region_rows
      where code is not null and code <> ''
    ),
    '[]'::jsonb
  ),
  'city',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'level', 'city',
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
      )
      from city_rows
      where code is not null and code <> ''
    ),
    '[]'::jsonb
  ),
  'district',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'level', 'district',
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
      )
      from district_rows
      where code is not null and code <> ''
    ),
    '[]'::jsonb
  )
);
$$;

create or replace function public.rpc_analyze_snapshot_daily(
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language sql
stable
security definer
set search_path = public, analytics, extensions, pg_temp
as $$
with filtered as materialized (
  select *
  from public._filtered_snapshot_listings_daily(coalesce(p_filters, '{}'::jsonb))
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
        'id', sampled.listing_id::text,
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
      listing_id,
      source,
      area_m2,
      price,
      price_per_m2,
      md5(listing_id::text) as sample_key
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
),
rankings_region as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'code', code,
        'level', 'region',
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
  ) as data
  from (
    select
      region_code as code,
      count(*)::integer as count,
      coalesce(avg(nullif(price, 0)), 0)::numeric as mean_price,
      coalesce(percentile_cont(0.5) within group (order by nullif(price, 0)), 0)::numeric as median_price,
      coalesce(avg(nullif(price_per_m2, 0)), 0)::numeric as mean_price_per_m2,
      coalesce(percentile_cont(0.5) within group (order by nullif(price_per_m2, 0)), 0)::numeric as median_price_per_m2,
      coalesce((count(*) filter (where goal = 'rent'))::numeric / nullif(count(*)::numeric, 0), 0) as rent_share,
      coalesce((count(*) filter (where goal = 'sale'))::numeric / nullif(count(*)::numeric, 0), 0) as sale_share
    from filtered
    group by region_code
  ) t
  where code is not null and code <> ''
),
rankings_city as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'code', code,
        'level', 'city',
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
  ) as data
  from (
    select
      city_code as code,
      count(*)::integer as count,
      coalesce(avg(nullif(price, 0)), 0)::numeric as mean_price,
      coalesce(percentile_cont(0.5) within group (order by nullif(price, 0)), 0)::numeric as median_price,
      coalesce(avg(nullif(price_per_m2, 0)), 0)::numeric as mean_price_per_m2,
      coalesce(percentile_cont(0.5) within group (order by nullif(price_per_m2, 0)), 0)::numeric as median_price_per_m2,
      coalesce((count(*) filter (where goal = 'rent'))::numeric / nullif(count(*)::numeric, 0), 0) as rent_share,
      coalesce((count(*) filter (where goal = 'sale'))::numeric / nullif(count(*)::numeric, 0), 0) as sale_share
    from filtered
    group by city_code
  ) t
  where code is not null and code <> ''
),
rankings_district as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'code', code,
        'level', 'district',
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
  ) as data
  from (
    select
      district_code as code,
      count(*)::integer as count,
      coalesce(avg(nullif(price, 0)), 0)::numeric as mean_price,
      coalesce(percentile_cont(0.5) within group (order by nullif(price, 0)), 0)::numeric as median_price,
      coalesce(avg(nullif(price_per_m2, 0)), 0)::numeric as mean_price_per_m2,
      coalesce(percentile_cont(0.5) within group (order by nullif(price_per_m2, 0)), 0)::numeric as median_price_per_m2,
      coalesce((count(*) filter (where goal = 'rent'))::numeric / nullif(count(*)::numeric, 0), 0) as rent_share,
      coalesce((count(*) filter (where goal = 'sale'))::numeric / nullif(count(*)::numeric, 0), 0) as sale_share
    from filtered
    group by district_code
  ) t
  where code is not null and code <> ''
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
  'cityGeo', city_geo.data,
  'rankingsRegion', rankings_region.data,
  'rankingsCity', rankings_city.data,
  'rankingsDistrict', rankings_district.data
)
from metrics
cross join goal_distribution
cross join property_mix
cross join city_distribution
cross join district_avg
cross join price_histogram
cross join area_histogram
cross join scatter_sample
cross join city_geo
cross join rankings_region
cross join rankings_city
cross join rankings_district;
$$;

-- Optimize live browse + map point RPCs --------------------------------------

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
  v_total_items integer := 0;
  v_total_pages integer := 1;
  v_rows jsonb := '[]'::jsonb;
begin
  with ordered as materialized (
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
      l.is_active,
      row_number() over (
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
      ) as row_num,
      count(*) over ()::integer as total_items
    from public._filtered_listings(coalesce(p_filters, '{}'::jsonb), null) as l
  ),
  summary as (
    select coalesce(max(total_items), 0)::integer as total_items
    from ordered
  ),
  page_meta as (
    select
      summary.total_items,
      greatest(1, ceil(summary.total_items::numeric / v_page_size)::integer) as total_pages,
      least(
        greatest(v_page, 1),
        greatest(1, ceil(summary.total_items::numeric / v_page_size)::integer)
      ) as safe_page
    from summary
  ),
  paged as (
    select
      o.id,
      o.source,
      o.external_id,
      o.listing_uri,
      o.goal,
      o.rent_frequency,
      o.price,
      o.area_m2,
      o.rooms,
      o.bedrooms,
      o.bathrooms,
      o.living_rooms,
      o.property_type,
      o.listing_type,
      o.region_code,
      o.city_code,
      o.district_code,
      o.latitude,
      o.longitude,
      o.price_per_m2,
      o.listed_at,
      o.last_seen_at,
      o.is_active,
      o.row_num
    from ordered as o
    cross join page_meta as pm
    where o.row_num > ((pm.safe_page - 1) * v_page_size)
      and o.row_num <= (pm.safe_page * v_page_size)
    order by o.row_num
  ),
  rows_json as (
    select coalesce(jsonb_agg(to_jsonb(paged) - 'row_num' order by row_num), '[]'::jsonb) as rows
    from paged
  )
  select
    pm.total_items,
    pm.total_pages,
    pm.safe_page,
    r.rows
  into v_total_items, v_total_pages, v_page, v_rows
  from page_meta as pm
  cross join rows_json as r;

  return jsonb_build_object(
    'rows', v_rows,
    'total_items', v_total_items,
    'page', v_page,
    'page_size', v_page_size,
    'total_pages', v_total_pages
  );
end;
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
  with ordered as materialized (
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
      l.is_active,
      row_number() over (order by l.listed_at desc nulls last, l.id desc) as row_num,
      count(*) over ()::integer as total_in_bounds
    from public._filtered_listings(coalesce(p_filters, '{}'::jsonb), p_bounds) as l
  ),
  summary as (
    select coalesce(max(total_in_bounds), 0)::integer as total_in_bounds
    from ordered
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
      is_active,
      row_num
    from ordered
    where row_num <= v_limit
    order by row_num
  ),
  rows_json as (
    select coalesce(jsonb_agg(to_jsonb(limited) - 'row_num' order by row_num), '[]'::jsonb) as rows
    from limited
  )
  select
    s.total_in_bounds,
    r.rows
  into v_total_in_bounds, v_rows
  from summary as s
  cross join rows_json as r;

  return jsonb_build_object(
    'rows', v_rows,
    'returned_count', coalesce(jsonb_array_length(v_rows), 0),
    'total_in_bounds', v_total_in_bounds
  );
end;
$$;

-- Wire daily snapshot capture into cron pipeline -----------------------------

create or replace function public.run_daily_analytics_refresh()
returns void
language plpgsql
security definer
set search_path = public, analytics, extensions, pg_temp
as $$
begin
  perform analytics.capture_daily_listing_snapshots((now() at time zone 'Asia/Riyadh')::date);
  perform analytics.capture_daily_snapshots((now() at time zone 'Asia/Riyadh')::date);
  perform public.refresh_read_models();
end;
$$;

-- Backfill latest snapshot for current date immediately on migration apply.
select analytics.capture_daily_listing_snapshots((now() at time zone 'Asia/Riyadh')::date);

-- Permissions ----------------------------------------------------------------

revoke all on table analytics.snapshot_listings_daily from anon, authenticated;

revoke all on function analytics.capture_daily_listing_snapshots(date) from public;
revoke all on function public._latest_snapshot_date() from public, anon, authenticated;
revoke all on function public._filtered_snapshot_listings_daily(jsonb) from public, anon, authenticated;
revoke all on function public.rpc_kpi_live(jsonb, jsonb) from public;
revoke all on function public.rpc_kpi_daily(jsonb) from public;
revoke all on function public.rpc_map_area_stats_daily_bundle(jsonb) from public;
revoke all on function public.rpc_analyze_snapshot_daily(jsonb) from public;

grant execute on function analytics.capture_daily_listing_snapshots(date) to service_role;
grant execute on function public.rpc_kpi_live(jsonb, jsonb) to anon, authenticated;
grant execute on function public.rpc_kpi_daily(jsonb) to anon, authenticated;
grant execute on function public.rpc_map_area_stats_daily_bundle(jsonb) to anon, authenticated;
grant execute on function public.rpc_analyze_snapshot_daily(jsonb) to anon, authenticated;
