import { BadRequestException } from "@nestjs/common";

/**
 * Validates a URL for provider fetching:
 * - Must be parseable
 * - Must use HTTPS
 * - Hostname must match one of the allowed suffixes (to prevent SSRF)
 */
export function validateProviderUrl(
  url: string,
  allowedHostSuffixes: string[],
): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException(`Invalid URL: ${url}`);
  }

  if (parsed.protocol !== "https:") {
    throw new BadRequestException(
      `Provider URL must use HTTPS (got ${parsed.protocol}): ${url}`,
    );
  }

  const host = parsed.hostname.toLowerCase();
  const allowed = allowedHostSuffixes.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
  if (!allowed) {
    throw new BadRequestException(
      `URL hostname "${host}" is not in the allowlist for this provider.`,
    );
  }
}
