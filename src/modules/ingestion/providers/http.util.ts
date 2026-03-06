import { Logger } from "@nestjs/common";

export type FetchJsonOptions = {
  timeoutMs?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
  method?: "GET" | "POST";
  body?: string;
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

export async function fetchTextWithRetry(
  url: string,
  opts: FetchJsonOptions = {},
  logger?: Logger,
) {
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const maxRetries = opts.maxRetries ?? 2;

  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: opts.method ?? "GET",
        headers: opts.headers,
        body: opts.body,
        signal: controller.signal,
      });

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
