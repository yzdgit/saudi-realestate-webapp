# Real Estate Explorer

A bilingual (English / Arabic) explorer for the Saudi residential and commercial real-estate market. Combines a fast listings workflow with region-level analytics and an interactive map — served entirely from a single static export, with **75,904 real listings** bundled as static data.

## Highlights

- **One UX model, two audiences.** `browse` mode for finding listings; `analyze` mode for understanding area-level market behaviour. Same filter model, same URL state.
- **URL-driven state.** Every filter, view, and mode is encoded in the URL. Every view is shareable and survives reload.
- **Map-first geographic exploration.** Hierarchical drilldown (region → city → district) with cached, simplified boundary overlays.
- **Robust analytics.** Outlier-safe statistics, log-normal-aware histograms, MAD-based winsorisation — designed to keep charts honest on long-tailed listing data.
- **Fully bundled.** No backend, no environment variables, no third-party CDN. The entire dataset and all geometry ships in the static build.
- **Bilingual.** Full Arabic and English translations with locale-aware routing (`/en/*`, `/ar/*`) and pre-hydration RTL flip to avoid LTR flash.

## Tech stack

- **Next.js 14** (Pages Router) with static export (`output: "export"`).
- **TypeScript** end-to-end with strict mode.
- **Tailwind CSS** + **shadcn/ui** (Radix primitives) for the component layer.
- **Leaflet** + **Supercluster** for the map and clustering.
- **Recharts** for analytics charts.
- **Bun** as runtime, package manager, and test runner.

## Data

The bundled dataset is built from a 75,904-row CSV of real Saudi listings sourced from public property platforms (aqar.fm, bayut.sa). A pre-build script normalises the CSV into a typed JSON payload that the client loads once and serves all queries from memory.

Source files (`app/src/data/`):
- `listings.csv` — 75,904 listings, 20 columns.
- `regions.geojson`, `cities.geojson`, `cities_polygons.geojson`, `districts.geojson` — Saudi administrative boundaries.

Build outputs (`app/public/static-data/`, gitignored, regenerated on every build):
- `listings.json` — normalised listings + counts metadata.
- Four geojson files copied through.

## Local development

```bash
bun install
bun run dev
```

The `predev` and `prebuild` scripts automatically run the static-data preparation step, so a fresh checkout works without manual setup.

Useful checks:

```bash
bun run typecheck
bun run lint
bun run test
bun run build
```

The build emits `app/out/`, which can be served by any static host — no environment variables, no runtime dependencies.

## GeoJSON optimisation

The committed boundary files have been simplified with [mapshaper](https://github.com/mbloch/mapshaper) — from 35 MB raw to ~3 MB total. To regenerate (one-time, requires `npx`):

```bash
npx -y mapshaper app/src/data/districts.geojson -simplify dp 4% keep-shapes -clean \
    -o force precision=0.00001 format=geojson app/src/data/districts.geojson

npx -y mapshaper app/src/data/regions.geojson -explode -simplify dp 2% keep-shapes -clean \
    -dissolve region_id copy-fields="region_id,name_en,name_ar" \
    -o force precision=0.00001 format=geojson app/src/data/regions.geojson

npx -y mapshaper app/src/data/cities_polygons.geojson -simplify dp 3% keep-shapes -clean \
    -o force precision=0.00001 format=geojson app/src/data/cities_polygons.geojson
```

## Architecture notes

- **State source of truth = URL.** `useUrlFilters()` parses `router.query` into a typed `ListingFilters` object and writes patches back with shallow replace. Every page renders deterministically from the URL.
- **Query layer is pure.** `app/src/lib/queries/realestate.ts` exposes a small surface (`fetchListingsBrowse`, `fetchKpiLive`, `fetchAnalyzeSnapshotDaily`, etc.) that delegates to pure functions in `pipeline.ts` operating on the loaded `Listing[]`. The Supabase-shaped contract is preserved so the UI is agnostic.
- **In-memory dataset, lazy-loaded.** `dataset.ts` fetches `/static-data/listings.json` once, caches the promise, and shares it across all subsequent calls.
- **Request cache.** `cache.ts` wraps every query with an LRU + AbortController layer that dedupes React-strict-mode double invokes and short-circuits identical filter payloads.
- **Map index.** `listings-map.tsx` builds a feature index from the geojson once and reuses it for every drilldown click.

## Tradeoffs

- Map listing density is capped to keep interaction smooth on the long-tail districts.
- Analytics are tuned for clarity over exhaustiveness — outliers are robustly handled but not exposed as a separate dimension.
- The dataset is a one-shot snapshot — no incremental updates, no live pricing.
