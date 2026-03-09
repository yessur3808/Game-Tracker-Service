import { Logger } from "@nestjs/common";

export type FetchJsonOptions = {
  timeoutMs?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
  method?: "GET" | "POST";
  body?: string;
  /**
   * Maximum number of redirects to follow. Defaults to 5.
   * Set to 0 to reject all redirects.
   */
  maxRedirects?: number;
  /**
   * Optional hook invoked with the resolved redirect URL before following it.
   * Throw (e.g. BadRequestException) to block the redirect.
   */
  validateRedirectUrl?: (url: string) => void;
};

export class ProviderHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
  ) {
    super(message);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isLikelyNetworkError(e: any) {
  const msg = String(e?.message || "");
  return (
    msg.includes("fetch failed") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("ETIMEDOUT")
  );
}

async function safeText(res: Response) {
  try {
    const txt = await res.text();
    return txt.slice(0, 800);
  } catch {
    return "";
  }
}

/**
 * Resolves and validates a redirect Location header.
 * - Resolves relative URLs against the current request URL.
 * - Enforces HTTPS on the redirect target to prevent downgrade attacks.
 * - Calls opts.validateRedirectUrl (if provided) for hostname allowlist checks.
 * Returns the resolved absolute URL to follow.
 */
function resolveRedirect(
  location: string,
  currentUrl: string,
  status: number,
  opts: FetchJsonOptions,
): string {
  let redirectUrl: URL;
  try {
    redirectUrl = new URL(location, currentUrl);
  } catch {
    throw new ProviderHttpError(
      `Redirect Location is not a valid URL: ${location}`,
      status,
      currentUrl,
    );
  }

  if (redirectUrl.protocol !== "https:") {
    throw new ProviderHttpError(
      `Redirect to non-HTTPS URL blocked: ${redirectUrl.href}`,
      status,
      currentUrl,
    );
  }

  opts.validateRedirectUrl?.(redirectUrl.href);
  return redirectUrl.href;
}

export async function fetchTextWithRetry(
  initialUrl: string,
  opts: FetchJsonOptions = {},
  logger?: Logger,
) {
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const maxRetries = opts.maxRetries ?? 2;
  const maxRedirects = opts.maxRedirects ?? 5;

  let url = initialUrl;
  let attempt = 0;
  let redirectsFollowed = 0;

  while (true) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: opts.method ?? "GET",
        headers: opts.headers,
        body: opts.body,
        signal: controller.signal,
        redirect: "manual",
      });

      // Handle redirects manually to prevent SSRF via redirect chains.
      // fetch() would otherwise silently follow 3xx to any host/protocol.
      if (res.status >= 300 && res.status < 400) {
        if (redirectsFollowed >= maxRedirects) {
          throw new ProviderHttpError(
            `Too many redirects (max ${maxRedirects})`,
            res.status,
            url,
          );
        }
        const location = res.headers.get("location");
        if (!location) {
          throw new ProviderHttpError(
            `Redirect response missing Location header`,
            res.status,
            url,
          );
        }
        url = resolveRedirect(location, url, res.status, opts);
        redirectsFollowed++;
        continue;
      }

      if (!res.ok) {
        const retryable =
          res.status === 429 || (res.status >= 500 && res.status <= 599);
        const snippet = await safeText(res);
        const err = new ProviderHttpError(
          `HTTP ${res.status} ${retryable ? "(retryable)" : "(fatal)"}: ${snippet}`,
          res.status,
          url,
        );

        if (retryable && attempt < maxRetries) {
          const backoff = 400 * Math.pow(2, attempt);
          logger?.warn(
            `Retry ${attempt + 1}/${maxRetries} in ${backoff}ms: ${url}`,
          );
          attempt++;
          await sleep(backoff);
          continue;
        }
        throw err;
      }

      return await res.text();
    } catch (e: any) {
      const isAbort = e?.name === "AbortError";
      if ((isAbort || isLikelyNetworkError(e)) && attempt < maxRetries) {
        const backoff = 400 * Math.pow(2, attempt);
        logger?.warn(
          `Retry ${attempt + 1}/${maxRetries} in ${backoff}ms: ${url}`,
        );
        attempt++;
        await sleep(backoff);
        continue;
      }
      throw e;
    } finally {
      clearTimeout(t);
    }
  }
}

export async function fetchJsonWithRetry<T = unknown>(
  url: string,
  opts: FetchJsonOptions = {},
  logger?: Logger,
): Promise<T> {
  const text = await fetchTextWithRetry(url, opts, logger);
  return JSON.parse(text) as T;
}
