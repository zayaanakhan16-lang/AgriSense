export class HttpError extends Error {
  readonly status: number;
  readonly url: string;
  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
  }
}

export interface FetchJsonOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
  retries?: number;
}

function timeoutSignal(ms: number, external?: AbortSignal): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), ms);
  const onAbort = (): void => controller.abort(external?.reason);
  external?.addEventListener('abort', onAbort, { once: true });
  return {
    signal: controller.signal,
    cancel: () => {
      clearTimeout(timer);
      external?.removeEventListener('abort', onAbort);
    },
  };
}

/** JSON fetch with timeout, abort propagation and bounded retries on transient failures. */
export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { timeoutMs = 20000, signal, method = 'GET', body, headers, retries = 1 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const { signal: composed, cancel } = timeoutSignal(timeoutMs, signal);
    try {
      const response = await fetch(url, {
        method,
        signal: composed,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        throw new HttpError(`${response.status} ${response.statusText}`, response.status, url);
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      const status = error instanceof HttpError ? error.status : 0;
      const retryable = status === 0 || status === 429 || status >= 500;
      if (!retryable || attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    } finally {
      cancel();
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function describeError(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.status === 404) return 'The upstream service returned no data for this location.';
    if (error.status === 429) return 'The upstream service is rate limiting requests. Try again shortly.';
    if (error.status >= 500) return 'The upstream service is currently unavailable.';
    return `Request failed (${error.status}).`;
  }
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return 'The request timed out before the service responded.';
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'The request was cancelled.';
  }
  if (error instanceof TypeError) {
    return 'Network request blocked or offline — the data source could not be reached.';
  }
  return error instanceof Error ? error.message : 'Unknown error';
}
