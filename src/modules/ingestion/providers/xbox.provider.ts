import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { fetchTextWithRetry } from "./http.util";
import { ProviderResult } from "./types";
import { validateProviderUrl } from "./url.util";
import { extractAllFromHtml } from "./html.util";

const XBOX_ALLOWED_HOSTS = ["xbox.com", "microsoft.com", "www.xbox.com"];

@Injectable()
export class XboxProvider {
  private readonly logger = new Logger(XboxProvider.name);
  constructor(private readonly config: ConfigService) {}

  async fetchByUrl(url: string): Promise<ProviderResult> {
    validateProviderUrl(url, XBOX_ALLOWED_HOSTS);

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
      provider: "xbox",
      fetchedAt: new Date().toISOString(),
      url,
      name: extracted.name,
      releaseText: extracted.releaseText ?? null,
      releaseDateISO: extracted.releaseDateISO ?? null,
      platforms: extracted.platforms,
      coverUrl: extracted.coverUrl ?? null,
      description: extracted.description ?? null,
      price: extracted.price ?? null,
      genres: extracted.genres,
    };
  }
}
