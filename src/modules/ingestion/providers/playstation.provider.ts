import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { fetchTextWithRetry } from "./http.util";
import { ProviderResult } from "./types";
import { validateProviderUrl } from "./url.util";

const PLAYSTATION_ALLOWED_HOSTS = [
  "playstation.com",
  "store.playstation.com",
  "www.playstation.com",
];

@Injectable()
export class PlayStationProvider {
  private readonly logger = new Logger(PlayStationProvider.name);
  constructor(private readonly config: ConfigService) {}

  async fetchByUrl(url: string): Promise<ProviderResult> {
    validateProviderUrl(url, PLAYSTATION_ALLOWED_HOSTS);

    const timeoutMs = this.config.get<number>("INGESTION_TIMEOUT_MS") ?? 12_000;
    const maxRetries = this.config.get<number>("INGESTION_MAX_RETRIES") ?? 2;
    const ua =
      this.config.get<string>("INGESTION_USER_AGENT") ??
      "GameTrackerBot/1.0 (+contact@example.com)";

    const html = await fetchTextWithRetry(
      url,
      {
        timeoutMs,
        maxRetries,
        headers: {
          "User-Agent": ua,
          Accept: "text/html,application/xhtml+xml",
        },
      },
      this.logger,
    );

    // Heuristic extraction (keep conservative)
    const name =
      extractMetaContent(html, "og:title") ?? extractTitleTag(html) ?? null;

    const releaseText = extractReleaseLikeText(html) ?? null;

    return {
      provider: "playstation",
      fetchedAt: new Date().toISOString(),
      url,
      name: cleanName(name),
      releaseText,
      releaseDateISO: null,
      platforms: [], // optional: you can infer "ps5/ps4" later if you extract it
      coverUrl: extractMetaContent(html, "og:image") ?? null,
    };
  }
}

function extractMetaContent(html: string, propertyOrName: string) {
  // matches: <meta property="og:title" content="...">
  const re1 = new RegExp(
    `<meta\\s+[^>]*(?:property|name)=["']${escapeRegExp(
      propertyOrName,
    )}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const m1 = html.match(re1);
  return m1?.[1]?.trim() ?? null;
}

function extractTitleTag(html: string) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() ?? null;
}

function extractReleaseLikeText(html: string) {
  // Very rough: look for “Release date” nearby.
  // This will not be perfect; we treat it as text only.
  const m = html.match(/release\s*date[^<]{0,80}([A-Za-z0-9,\s]{3,40})/i);
  return m?.[1]?.trim() ?? null;
}

function cleanName(name: string | null) {
  if (!name) return null;
  return name.replace(/\s+\|\s+PlayStation.*/i, "").trim();
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
