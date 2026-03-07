-- 006_rls.sql
-- RLS policies for public read / service-role writes.

alter table public.listings enable row level security;

create policy "Public read listings"
on public.listings
for select
using (true);
