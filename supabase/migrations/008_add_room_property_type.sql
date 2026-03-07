alter table public.listings
drop constraint if exists listings_property_type_check;

alter table public.listings
add constraint listings_property_type_check
check (
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
);
