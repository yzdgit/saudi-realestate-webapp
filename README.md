# realestate-eda

Real estate listings explorer for Aqar, Bayut, and Dealapp.

## Stack
- Frontend: Next.js (Pages Router), full CSR data loading, shadcn/ui-ready structure
- Backend: Supabase (Postgres, Edge Functions, migrations)
- Tooling: Bun + Supabase CLI

## i18n + SEO approach (No SSR)
- Locale-first static routes: `/en/*` and `/ar/*`
- Dynamic route generation with `getStaticPaths` for locale pages only
- Listing data and EDA widgets hydrate client-side from Supabase
- SEO uses static locale URLs + locale alternates (no runtime SSR)

## Quick start
```bash
bun install
bun run dev
```

Supabase local:
```bash
bun run supabase:start
```
