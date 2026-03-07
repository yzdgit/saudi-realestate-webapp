import type { StagingListingRow } from "./types.ts";

export async function upsertStaging(_rows: StagingListingRow[]): Promise<void> {
  // TODO: implement Supabase client upsert into staging.raw_listings.
}
