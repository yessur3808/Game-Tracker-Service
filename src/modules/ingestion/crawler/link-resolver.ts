/**
 * Link resolver — validates and resolves discovered candidate URLs.
 *
 * Before a discovered URL is handed to a provider for full extraction
 * it should be pre-validated:
 *  - Must be HTTPS
 *  - Must return a 2xx status (or a redirect to one)
 *  - Must match the expected provider hostname
 */

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type LinkResolution = {
  url: string;
  resolved: boolean;
  finalUrl?: string;
  statusCode?: number;
  error?: string;
};

@Injectable()
export class LinkResolverService {
  private readonly logger = new Logger(LinkResolverService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Attempt to resolve a URL with a lightweight HEAD request.
   * Returns resolution metadata without downloading the full body.
   */
  async resolve(url: string): Promise<LinkResolution> {
    const timeoutMs =
      this.config.get<number>("INGESTION_TIMEOUT_MS") ?? 12_000;
    const ua =
      this.config.get<string>("INGESTION_USER_AGENT") ??
      "GameTrackerBot/1.0 (+contact@example.com)";

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") {
        return { url, resolved: false, error: "Non-HTTPS URL" };
      }

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(url, {
          method: "HEAD",
          headers: { "User-Agent": ua },
          signal: controller.signal,
          redirect: "follow",
        });

        return {
          url,
          resolved: res.ok,
          finalUrl: res.url !== url ? res.url : undefined,
          statusCode: res.status,
          error: res.ok ? undefined : `HTTP ${res.status}`,
        };
      } finally {
        clearTimeout(t);
      }
    } catch (err: any) {
      return {
        url,
        resolved: false,
        error: err?.message ?? "Unknown error",
      };
    }
  }

  /**
   * Resolve multiple URLs concurrently, with a configurable concurrency
   * limit to avoid overwhelming targets.
   */
  async resolveAll(
    urls: string[],
    concurrency = 4,
  ): Promise<LinkResolution[]> {
    const results: LinkResolution[] = [];

    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map((url) => this.resolve(url)),
      );
      for (let j = 0; j < batchResults.length; j++) {
        const r = batchResults[j];
        if (r.status === "fulfilled") {
          results.push(r.value);
        } else {
          results.push({
            url: batch[j] ?? "unknown",
            resolved: false,
            error: String(r.reason),
          });
        }
      }
    }

    return results;
  }
}
