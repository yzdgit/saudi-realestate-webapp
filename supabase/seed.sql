-- Optional local seed data.

insert into public.listings (source, external_id, title, city, district, price, area_m2, listed_at)
values
  ('aqar', 'seed-aqar-1', 'Seed Listing A', 'Riyadh', 'Al Olaya', 1200000, 220, now()),
  ('bayut', 'seed-bayut-1', 'Seed Listing B', 'Jeddah', 'Al Rawdah', 950000, 180, now())
on conflict (source, external_id) do nothing;
