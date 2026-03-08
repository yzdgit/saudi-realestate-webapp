# Real Estate Explorer

I built this project to explore a practical question: how can one app serve both people looking for properties and people analyzing market behavior?

It combines a fast listings workflow with region-level analytics, using one shared filter model and a map-first exploration experience.

## Project Goals

- Build a bilingual real estate experience for Arabic and English users.
- Support two audiences with one UX model:
  - `browse`: find listings quickly.
  - `analyze`: understand area-level market patterns.
- Keep navigation and state predictable through URL-driven controls.
- Keep performance stable with large datasets and frequent map interactions.

## Core Capabilities

- **Two top-level controls**
  - `view`: `listings` or `map`
  - `mode`: `browse` or `analyze` (explicit in URL)
- **Listings workflow**
  - Filtered table browsing
  - Pagination and sorting
  - Listing detail inspection and comparison
  - Outlier labeling at row level
- **Map workflow**
  - Hierarchical geography drilldown (region -> city -> district)
  - Boundary overlays and hover stats
  - District-gated listing visibility for cleaner map interaction
- **Analytics workflow**
  - Area rankings and KPI summaries
  - Robust chart shaping with outlier-safe statistics
  - Filter-aware metrics without single-listing dependence
- **Localization**
  - Locale routes (`/en/*`, `/ar/*`)
  - Localized labels and number formatting

## System Design (High Level)

- **Client application**
  - Next.js Pages Router with strict CSR data loading.
  - URL as source of truth for filters, view, and mode.
- **Data access layer**
  - Browser calls to a managed data API via RPC-style endpoints.
  - Shared query helpers for listings, map stats, and analyze payloads.
  - Client-side caching, deduping, and abort-aware request handling.
- **Geospatial layer**
  - Polygon boundaries served as static GeoJSON assets from `https://cdn.namla.sa/geojson/{filename}`.
  - Client-side map indexing, drill-level selection, and overlay rendering.
- **Build/deploy shape**
  - Static export output from Next.js.
  - Ready for edge-hosted static deployment.

## Techniques Used

- URL-state modeling for deterministic navigation and sharable views
- Mode/view behavioral separation for multi-audience UX
- Map interaction throttling + request cancellation to reduce jank
- Outlier policy with hard validity + robust statistics for better charts
- Typed query mapping and normalized filter contracts
- Locale-first routing with static generation for route shells

## Cloudflare Pages Deployment

This project is configured for static export.

1. Set your production environment variables in Cloudflare Pages (see `.env.example` for required keys).
2. Use:
   - Build command: `bun run build`
   - Output directory: `app/out`
3. Deploy.

## Local Development

```bash
bun install
bun run dev
```

Useful checks:

```bash
bun run typecheck
bun run lint
bun run build
```

## Tradeoffs and Current Limits

- Analytics are optimized for responsiveness and clarity over exhaustive chart depth.
- Map display intentionally limits listing point density to keep interaction smooth.
- Some data-quality decisions (for example outlier treatment) are opinionated and tuned for this dataset shape.

## Next Improvements

- Precomputed boundary metadata to reduce client map CPU work further.
- Broader synthetic test coverage for heavy-filter and rapid-navigation scenarios.
- More portfolio-facing documentation around architecture decisions and performance benchmarks.
