import { getMockListings } from "@/lib/realestate/mock-repository";
import type { Listing } from "@/lib/realestate/types";

export async function fetchLatestListings(limit = 50): Promise<Listing[]> {
  return getMockListings().slice(0, limit);
}
