type CacheEntry<T> = {
  value?: T;
  updatedAt: number;
  expiresAt: number;
  inflight?: Promise<T>;
  controller?: AbortController;
};

type CachedQueryOptions<T> = {
  key: string;
  fetcher: (signal: AbortSignal) => Promise<T>;
  signal?: AbortSignal;
  ttlMs?: number;
  staleWhileRevalidate?: boolean;
  staleOnError?: boolean;
  maxEntries?: number;
  retryOnInflightAbort?: boolean;
};

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 220;

const queryCache = new Map<string, CacheEntry<unknown>>();

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function touchCache(maxEntries: number): void {
  if (queryCache.size <= maxEntries) {
    return;
  }

  const candidates = Array.from(queryCache.entries())
    .filter(([, entry]) => !entry.inflight)
    .sort((left, right) => left[1].updatedAt - right[1].updatedAt);

  for (const [key] of candidates) {
    if (queryCache.size <= maxEntries) {
      break;
    }

    queryCache.delete(key);
  }
}

function stringifyStable(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyStable(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const body = keys
    .map((key) => `${JSON.stringify(key)}:${stringifyStable(record[key])}`)
    .join(",");

  return `{${body}}`;
}

export function buildCacheKey(scope: string, payload?: unknown): string {
  if (typeof payload === "undefined") {
    return scope;
  }

  return `${scope}:${stringifyStable(payload)}`;
}

export async function runCachedQuery<T>({
  key,
  fetcher,
  signal,
  ttlMs = DEFAULT_TTL_MS,
  staleWhileRevalidate = true,
  staleOnError = true,
  maxEntries = DEFAULT_MAX_ENTRIES,
  retryOnInflightAbort = true
}: CachedQueryOptions<T>): Promise<T> {
  const now = Date.now();
  const cachedEntry = queryCache.get(key) as CacheEntry<T> | undefined;
  const entry: CacheEntry<T> = cachedEntry ?? {
    updatedAt: 0,
    expiresAt: 0
  };

  if (!cachedEntry) {
    queryCache.set(key, entry);
  }

  if (typeof entry.value !== "undefined" && now <= entry.expiresAt) {
    return entry.value;
  }

  if (entry.inflight) {
    if (typeof entry.value !== "undefined" && staleWhileRevalidate) {
      void entry.inflight.catch(() => undefined);
      return entry.value;
    }

    return entry.inflight.catch((error) => {
      if (!retryOnInflightAbort || !isAbortError(error)) {
        throw error;
      }

      if (entry.inflight) {
        entry.inflight = undefined;
        entry.controller = undefined;
      }

      return runCachedQuery({
        key,
        fetcher,
        signal,
        ttlMs,
        staleWhileRevalidate,
        staleOnError,
        maxEntries,
        retryOnInflightAbort: false
      });
    });
  }

  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  const request = fetcher(controller.signal)
    .then((value) => {
      if (controller.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const timestamp = Date.now();
      entry.value = value;
      entry.updatedAt = timestamp;
      entry.expiresAt = timestamp + ttlMs;
      return value;
    })
    .catch((error) => {
      if (staleOnError && typeof entry.value !== "undefined" && !isAbortError(error)) {
        return entry.value;
      }

      throw error;
    })
    .finally(() => {
      if (signal) {
        signal.removeEventListener("abort", onExternalAbort);
      }

      if (entry.inflight === request) {
        entry.inflight = undefined;
        entry.controller = undefined;
      }

      touchCache(maxEntries);
    });

  entry.inflight = request;
  entry.controller = controller;

  if (typeof entry.value !== "undefined" && staleWhileRevalidate) {
    void request.catch(() => undefined);
    return entry.value;
  }

  return request;
}

export function clearCachedQueries(prefix?: string): void {
  if (!prefix) {
    queryCache.clear();
    return;
  }

  for (const key of queryCache.keys()) {
    if (key.startsWith(prefix)) {
      queryCache.delete(key);
    }
  }
}

export function cancelCachedQueries(prefix?: string): void {
  for (const [key, entry] of queryCache.entries()) {
    if (prefix && !key.startsWith(prefix)) {
      continue;
    }

    entry.controller?.abort();
  }
}
