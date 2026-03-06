import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ProviderResult } from "./types";
import { fetchTextWithRetry } from "./http.util";

type TwitchTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: "bearer";
};

@Injectable()
export class IgdbProvider {
  private readonly logger = new Logger(IgdbProvider.name);

  private token: { value: string; expiresAtMs: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  private get clientId() {
    return this.config.getOrThrow<string>("TWITCH_CLIENT_ID");
  }
  private get clientSecret() {
    return this.config.getOrThrow<string>("TWITCH_CLIENT_SECRET");
  }

  private get timeoutMs() {
    return this.config.get<number>("INGESTION_TIMEOUT_MS") ?? 12_000;
  }
  private get maxRetries() {
    return this.config.get<number>("INGESTION_MAX_RETRIES") ?? 2;
  }

  async fetchGameById(igdbId: number): Promise<any | null> {
    const q = `
      fields id,name,first_release_date,release_dates.date,release_dates.platform,release_dates.region,release_dates.status,
             platforms.abbreviation,platforms.name,
             cover.url, websites.url, websites.category;
      where id = ${igdbId};
      limit 1;
    `;
    const arr = await this.igdbPost("/v4/games", q);
    return Array.isArray(arr) ? (arr[0] ?? null) : null;
  }

  async fetchNormalizedById(igdbId: number): Promise<ProviderResult> {
    const g = await this.fetchGameById(igdbId);
    return {
      provider: "igdb",
      fetchedAt: new Date().toISOString(),
      externalId: igdbId,
      name: g?.name ?? null,
      releaseText: null,
      releaseDateISO: g?.first_release_date
        ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10)
        : null,
      platforms: Array.isArray(g?.platforms)
        ? g.platforms
            .map((p: any) => p?.abbreviation || p?.name)
            .filter(Boolean)
        : [],
      coverUrl: normalizeIgdbImageUrl(g?.cover?.url ?? null),
    };
  }

  async searchNormalized(name: string, limit = 5): Promise<ProviderResult[]> {
    const q = `
      search "${escapeIgdbString(name)}";
      fields id,name,first_release_date,platforms.abbreviation,platforms.name,cover.url;
      limit ${Math.max(1, Math.min(limit, 50))};
    `;
    const arr = await this.igdbPost("/v4/games", q);
    if (!Array.isArray(arr)) return [];
    return arr.map((g: any) => ({
      provider: "igdb",
      fetchedAt: new Date().toISOString(),
      externalId: g?.id,
      name: g?.name ?? null,
      releaseDateISO: g?.first_release_date
        ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10)
        : null,
      releaseText: null,
      platforms: Array.isArray(g?.platforms)
        ? g.platforms
            .map((p: any) => p?.abbreviation || p?.name)
            .filter(Boolean)
        : [],
      coverUrl: normalizeIgdbImageUrl(g?.cover?.url ?? null),
    }));
  }

  private async igdbPost(path: string, body: string): Promise<any> {
    const token = await this.getToken();
    const url = `https://api.igdb.com${path}`;

    const text = await fetchTextWithRetry(
      url,
      {
        method: "POST",
        body,
        timeoutMs: this.timeoutMs,
        maxRetries: this.maxRetries,
        headers: {
          "Client-ID": this.clientId,
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "text/plain",
        },
      },
      this.logger,
    );

    return JSON.parse(text);
  }

  private async getToken(): Promise<string> {
    const now = Date.now();
    if (this.token && now < this.token.expiresAtMs - 60_000)
      return this.token.value;

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "client_credentials",
    });

    const text = await fetchTextWithRetry(
      "https://id.twitch.tv/oauth2/token",
      {
        method: "POST",
        body: params.toString(),
        timeoutMs: this.timeoutMs,
        maxRetries: this.maxRetries,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
      this.logger,
    );
    const json = JSON.parse(text) as TwitchTokenResponse;

    this.token = {
      value: json.access_token,
      expiresAtMs: Date.now() + json.expires_in * 1000,
    };
    return this.token.value;
  }
}

function escapeIgdbString(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function normalizeIgdbImageUrl(url: string | null) {
  if (!url) return null;
  // IGDB often returns URLs like: //images.igdb.com/igdb/image/upload/t_thumb/...
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}
