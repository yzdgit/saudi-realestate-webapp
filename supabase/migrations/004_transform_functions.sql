-- 004_transform_functions.sql
-- Transformation functions from staging to public models.

create or replace function public.transform_staging_to_listings()
returns void
language plpgsql
as $$
begin
  -- TODO: map staging payload into public.listings
  null;
end;
$$;
