import type { Listing } from "@/lib/realestate/types";

type DatasetPayload = {
  listings: Listing[];
  counts?: { activeRows: number; totalRows: number };
};

type UriLookup = Record<string, string>;

const DATASET_PATH = "/static-data/listings.json";
const URI_LOOKUP_PATH = "/static-data/listing-uris.json";

let datasetPromise: Promise<Listing[]> | null = null;
let uriLookupPromise: Promise<UriLookup> | null = null;

function compareListedAtDesc(left: Listing, right: Listing): number {
  const leftAt = left.listed_at ?? "";
  const rightAt = right.listed_at ?? "";

  if (leftAt === rightAt) {
    return left.id < right.id ? 1 : -1;
  }

  return leftAt < rightAt ? 1 : -1;
}

function fetchDataset(): Promise<Listing[]> {
  return fetch(DATASET_PATH, { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load dataset (${response.status})`);
      }
      return response.json() as Promise<DatasetPayload>;
    })
    .then((payload) => {
      const listings = payload.listings;
      // Restore raw_rent_frequency (stripped from disk to save bandwidth — it's
      // always equal to rent_frequency after normalization).
      for (let i = 0; i < listings.length; i += 1) {
        const item = listings[i];
        if (!item.raw_rent_frequency && item.rent_frequency) {
          item.raw_rent_frequency = item.rent_frequency;
        }
      }
      // Pre-sort newest-first so applySorting("newest") can short-circuit.
      listings.sort(compareListedAtDesc);
      return listings;
    });
}

export function loadDataset(signal?: AbortSignal): Promise<Listing[]> {
  if (!datasetPromise) {
    datasetPromise = fetchDataset().catch((error) => {
      datasetPromise = null;
      throw error;
    });
  }

  const inFlight = datasetPromise;

  if (!signal) {
    return inFlight;
  }

  if (signal.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }

  return new Promise<Listing[]>((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });

    inFlight.then(
      (data) => {
        signal.removeEventListener("abort", onAbort);
        resolve(data);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

function fetchUriLookup(): Promise<UriLookup> {
  return fetch(URI_LOOKUP_PATH, { cache: "force-cache" }).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to load listing URIs (${response.status})`);
    }
    return response.json() as Promise<UriLookup>;
  });
}

export function loadListingUri(id: string): Promise<string | undefined> {
  if (!uriLookupPromise) {
    uriLookupPromise = fetchUriLookup().catch((error) => {
      uriLookupPromise = null;
      throw error;
    });
  }

  return uriLookupPromise.then((lookup) => lookup[id]);
}

export function resetDataset(): void {
  datasetPromise = null;
  uriLookupPromise = null;
}
