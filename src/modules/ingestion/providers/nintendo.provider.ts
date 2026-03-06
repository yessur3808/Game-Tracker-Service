import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { fetchTextWithRetry } from "./http.util";
import { ProviderResult } from "./types";
import { validateProviderUrl } from "./url.util";

const NINTENDO_ALLOWED_HOSTS = [
  "nintendo.com",
  "nintendo.co.uk",
  "nintendo.co.jp",
  "nintendo.de",
  "nintendo.fr",
  "nintendo.es",
  "nintendo.it",
  "nintendo.nl",
  "nintendo.pt",
  "nintendo.com.au",
  "nintendo-europe.com",
];

@Injectable()
export class NintendoProvider {
  private readonly logger = new Logger(NintendoProvider.name);
  constructor(private readonly config: ConfigService) {}

  async fetchByUrl(url: string): Promise<ProviderResult> {
    validateProviderUrl(url, NINTENDO_ALLOWED_HOSTS);

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

    const name =
      extractMetaContent(html, "og:title") ?? extractTitleTag(html) ?? null;

    const releaseText =
      extractJsonLdReleaseDate(html) ?? extractReleaseLikeText(html) ?? null;

    return {
      provider: "nintendo",
      fetchedAt: new Date().toISOString(),
      url,
      name,
      releaseText,
      releaseDateISO: null,
      platforms: ["switch"], // usually correct for Nintendo store; adjust if you add Switch 2 etc.
      coverUrl: extractMetaContent(html, "og:image") ?? null,
    };
  }
}

function extractJsonLdReleaseDate(html: string) {
  const m = html.match(/"releaseDate"\s*:\s*"([^"]+)"/i);
  return m?.[1]?.trim() ?? null;
}
function extractMetaContent(html: string, propertyOrName: string) {
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
  const m = html.match(/release\s*date[^<]{0,80}([A-Za-z0-9,\s-]{3,40})/i);
  return m?.[1]?.trim() ?? null;
}
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
