import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { fetchJsonWithRetry, ProviderHttpError } from "./http.util";
import { ProviderResult } from "./types";

export { ProviderHttpError };

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
    };
  }
>;

export type SteamAppDetails = NonNullable<
  SteamAppDetailsResponse[string]["data"]
>;

export type SteamFetchOptions = {
  cc?: string;
  l?: string;
  timeoutMs?: number;
  maxRetries?: number;
};

@Injectable()
export class SteamProvider {
  private readonly logger = new Logger(SteamProvider.name);

  constructor(private readonly config: ConfigService) {}

  private get userAgent() {
    return (
      this.config.get<string>("INGESTION_USER_AGENT") ??
      "GameTrackerBot/1.0 (+contact@example.com)"
    );
  }
  private get defaultTimeoutMs() {
    return this.config.get<number>("INGESTION_TIMEOUT_MS") ?? 12_000;
  }
  private get defaultMaxRetries() {
    return this.config.get<number>("INGESTION_MAX_RETRIES") ?? 2;
  }

  async fetchByAppId(appId: number, opts: SteamFetchOptions = {}) {
    const cc = opts.cc ?? this.config.get<string>("DEFAULT_STORE_REGION") ?? "us";
    const l = opts.l ?? this.config.get<string>("DEFAULT_STORE_LANGUAGE") ?? "en";
    const timeoutMs = opts.timeoutMs ?? this.defaultTimeoutMs;
    const maxRetries = opts.maxRetries ?? this.defaultMaxRetries;

    const url = `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(
      String(appId),
    )}&cc=${encodeURIComponent(cc)}&l=${encodeURIComponent(l)}`;

    const json = await fetchJsonWithRetry<SteamAppDetailsResponse>(
      url,
      {
        timeoutMs,
        maxRetries,
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/json,text/plain,*/*",
        },
      },
      this.logger,
    );

    const entry = json[String(appId)];
    if (!entry?.success || !entry.data) {
      throw new Error(`Steam appdetails missing data for appId=${appId}`);
    }
    return entry.data;
  }

  async fetchNormalized(
    appId: number,
    opts: SteamFetchOptions = {},
  ): Promise<ProviderResult> {
    const data = await this.fetchByAppId(appId, opts);

    const platformTags: string[] = [];
    if (data.platforms?.windows) platformTags.push("pc");
    if (data.platforms?.mac) platformTags.push("mac");
    if (data.platforms?.linux) platformTags.push("linux");

    const releaseText = data.release_date?.date?.trim() || null;

    return {
      provider: "steam",
      fetchedAt: new Date().toISOString(),
      externalId: appId,
      url: `https://store.steampowered.com/app/${appId}/`,
      name: data.name ?? null,
      releaseText,
      releaseDateISO: null,
      platforms: platformTags,
      coverUrl: data.header_image ?? null,
    };
  }
}
