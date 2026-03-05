import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { fetchTextWithRetry } from "./http.util";
import { ProviderResult } from "./types";

@Injectable()
export class XboxProvider {
  private readonly logger = new Logger(XboxProvider.name);
  constructor(private readonly config: ConfigService) {}

  async fetchByUrl(url: string): Promise<ProviderResult> {
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

    // Xbox pages sometimes have JSON-LD; try that first.
    const releaseText =
      extractJsonLdReleaseDate(html) ?? extractReleaseLikeText(html);

    return {
      provider: "xbox",
      fetchedAt: new Date().toISOString(),
      url,
      name,
      releaseText: releaseText ?? null,
      releaseDateISO: null,
      platforms: [],
      coverUrl: extractMetaContent(html, "og:image") ?? null,
    };
  }
}

function extractJsonLdReleaseDate(html: string) {
  // Try to locate a "releaseDate":"YYYY-MM-DD" in JSON-LD blobs
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
