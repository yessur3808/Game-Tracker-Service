import { Injectable, Logger } from "@nestjs/common";

type SteamAppDetailsResponse = Record<
  string,
  {
    success: boolean;
    data?: {
      steam_appid?: number;
      name?: string;
      release_date?: { coming_soon?: boolean; date?: string };
      platforms?: { windows?: boolean; mac?: boolean; linux?: boolean };
      header_image?: string;
      website?: string;
      // lots more exists, but keep it minimal
    };
  }
>;

export type SteamAppDetails = NonNullable<
  SteamAppDetailsResponse[string]["data"]
>;

export type SteamFetchOptions = {
  cc?: string; // country code, e.g. "us"
  l?: string; // language, e.g. "en"
  timeoutMs?: number;
  maxRetries?: number;
};

class ProviderHttpError extends Error {
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

@Injectable()
export class SteamProvider {
  private readonly logger = new Logger(SteamProvider.name);

  // You can move these to ConfigService later.
  private readonly defaultUserAgent =
    "GameTrackerBot/1.0 (+contact@example.com)";
  private readonly defaultTimeoutMs = 12_000;
  private readonly defaultMaxRetries = 2;

  async fetchByAppId(appId: number, opts: SteamFetchOptions = {}) {
    const cc = opts.cc ?? "us";
    const l = opts.l ?? "en";
    const timeoutMs = opts.timeoutMs ?? this.defaultTimeoutMs;
    const maxRetries = opts.maxRetries ?? this.defaultMaxRetries;

    const url = `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(
      String(appId),
    )}&cc=${encodeURIComponent(cc)}&l=${encodeURIComponent(l)}`;

    const data = await this.fetchJsonWithRetry(url, timeoutMs, maxRetries);
    const json = data as SteamAppDetailsResponse;

    const entry = json[String(appId)];
    if (!entry?.success || !entry.data) {
      throw new Error(`Steam appdetails missing data for appId=${appId}`);
    }
    return entry.data;
  }

  /**
   * Optional helper: normalize into a stable internal shape.
   * (This is NOT your frontend schema yet; just a cleaner provider output.)
   */
  async fetchNormalized(appId: number, opts: SteamFetchOptions = {}) {
    const data = await this.fetchByAppId(appId, opts);

    const platforms = {
      windows: !!data.platforms?.windows,
      mac: !!data.platforms?.mac,
      linux: !!data.platforms?.linux,
    };

    const releaseText = data.release_date?.date?.trim() || null;
    const comingSoon = !!data.release_date?.coming_soon;

    return {
      provider: "steam" as const,
      appId,
      name: data.name ?? null,
      headerImage: data.header_image ?? null,
      website: data.website ?? null,
      platforms,
      releaseText,
      comingSoon,
      fetchedAt: new Date().toISOString(),
      storeUrl: `https://store.steampowered.com/app/${appId}/`,
    };
  }

  private async fetchJsonWithRetry(
    url: string,
    timeoutMs: number,
    maxRetries: number,
  ): Promise<unknown> {
    let attempt = 0;

    while (true) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": this.defaultUserAgent,
            Accept: "application/json,text/plain,*/*",
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          // Retry on rate limit or transient server issues
          const retryable =
            res.status === 429 || (res.status >= 500 && res.status <= 599);

          const bodySnippet = await safeText(res);
          const err = new ProviderHttpError(
            `Steam HTTP ${res.status} (${retryable ? "retryable" : "fatal"}): ${bodySnippet}`,
            res.status,
            url,
          );

          if (retryable && attempt < maxRetries) {
            const backoff = 400 * Math.pow(2, attempt);
            this.logger.warn(
              `Steam fetch retry ${attempt + 1}/${maxRetries} in ${backoff}ms: ${url}`,
            );
            attempt++;
            await sleep(backoff);
            continue;
          }

          throw err;
        }

        return await res.json();
      } catch (e: any) {
        const isAbort = e?.name === "AbortError";

        // Network/timeout retry
        if (
          (isAbort || (await isLikelyNetworkError(e))) &&
          attempt < maxRetries
        ) {
          const backoff = 400 * Math.pow(2, attempt);
          this.logger.warn(
            `Steam fetch network/timeout retry ${attempt + 1}/${maxRetries} in ${backoff}ms: ${url}`,
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
}

const safeText = async (res: Response) => {
  try {
    const txt = await res.text();
    return txt.slice(0, 500);
  } catch {
    return "";
  }
};

const isLikelyNetworkError = async (e: any) => {
  const msg = String(e?.message || "");
  return (
    msg.includes("fetch failed") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("ETIMEDOUT")
  );
};
