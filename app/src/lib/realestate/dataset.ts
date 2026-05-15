import type { Listing } from "@/lib/realestate/types";

type DatasetPayload = {
  listings: Listing[];
  counts?: { activeRows: number; totalRows: number };
};

const DATASET_PATH = "/static-data/listings.json";

let datasetPromise: Promise<Listing[]> | null = null;

function fetchDataset(): Promise<Listing[]> {
  return fetch(DATASET_PATH, { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load dataset (${response.status})`);
      }
      return response.json() as Promise<DatasetPayload>;
    })
    .then((payload) => payload.listings);
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

export function resetDataset(): void {
  datasetPromise = null;
}
