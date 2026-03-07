-- backend_v1.sql
-- Run after migrations/seed to validate core invariants and inspect query plans.

-- Basic schema assertions.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listings'
      and column_name = 'price_per_m2'
  ) then
    raise exception 'missing public.listings.price_per_m2 generated column';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'i'
      and n.nspname = 'public'
      and c.relname = 'listings_geom_gist_idx'
  ) then
    raise exception 'missing GiST index listings_geom_gist_idx';
  end if;
end;
$$;

-- RPC smoke tests.
select public.rpc_filter_options();
select public.rpc_listings_browse('{"goal":"sale","listing_type":"residential"}'::jsonb, 'newest', 1, 12);
select public.rpc_geo_rankings('{"goal":"sale"}'::jsonb, 'region');
select public.rpc_map_points(
  '{"goal":"sale"}'::jsonb,
  '{"north":26.0,"south":20.0,"east":50.5,"west":39.0}'::jsonb,
  500
);
select public.rpc_map_area_stats('{"goal":"sale"}'::jsonb, 'city', null, null);
select public.rpc_listings_stats('{"goal":"sale"}'::jsonb, null);

-- Explain plans (replace filters/bounds with realistic prod samples as needed).
explain analyze
select public.rpc_listings_browse(
  '{"goal":"sale","listing_type":"residential","region":["1"]}'::jsonb,
  'newest',
  1,
  12
);

explain analyze
select public.rpc_map_points(
  '{"goal":"sale","listing_type":"residential"}'::jsonb,
  '{"north":25.0,"south":24.4,"east":47.1,"west":46.3}'::jsonb,
  500
);

explain analyze
select public.rpc_listings_stats(
  '{"goal":"sale","listing_type":"residential","region":["1"]}'::jsonb,
  null
);
