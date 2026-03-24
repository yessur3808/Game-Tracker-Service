import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { fetchTextWithRetry } from "./http.util";
import { ProviderResult } from "./types";
import { validateProviderUrl } from "./url.util";
import { extractAllFromHtml } from "./html.util";

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

    const extracted = extractAllFromHtml(html);

    return {
      provider: "nintendo",
      fetchedAt: new Date().toISOString(),
      url,
      name: extracted.name,
      releaseText: extracted.releaseText ?? null,
      releaseDateISO: extracted.releaseDateISO ?? null,
      platforms: extracted.platforms.length > 0 ? extracted.platforms : ["switch"],
      coverUrl: extracted.coverUrl ?? null,
      description: extracted.description ?? null,
      price: extracted.price ?? null,
      genres: extracted.genres,
    };
  }
}
