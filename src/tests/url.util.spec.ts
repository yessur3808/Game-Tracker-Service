import { validateProviderUrl } from "../modules/ingestion/providers/url.util";
import { BadRequestException } from "@nestjs/common";

describe("validateProviderUrl", () => {
  const allowed = ["steampowered.com", "store.steampowered.com"];

  it("passes for an exactly-matching HTTPS host", () => {
    expect(() =>
      validateProviderUrl("https://steampowered.com/app/123", allowed),
    ).not.toThrow();
  });

  it("passes for a subdomain of an allowed suffix", () => {
    expect(() =>
      validateProviderUrl("https://store.steampowered.com/app/123", allowed),
    ).not.toThrow();
  });

  it("throws BadRequestException for HTTP (not HTTPS)", () => {
    expect(() =>
      validateProviderUrl("http://steampowered.com/app/123", allowed),
    ).toThrow(BadRequestException);
  });

  it("throws for a hostname not in the allowlist", () => {
    expect(() =>
      validateProviderUrl("https://evil.com/steampowered.com", allowed),
    ).toThrow(BadRequestException);
  });

  it("throws for an invalid / unparseable URL", () => {
    expect(() =>
      validateProviderUrl("not-a-url", allowed),
    ).toThrow(BadRequestException);
  });

  it("rejects a crafted subdomain that includes an allowed suffix as a substring but is a different host", () => {
    // 'evilsteampowered.com' is NOT a subdomain of 'steampowered.com'
    expect(() =>
      validateProviderUrl("https://evilsteampowered.com/app/1", allowed),
    ).toThrow(BadRequestException);
  });

  it("passes for deep subdomain of an allowed suffix", () => {
    expect(() =>
      validateProviderUrl("https://api.store.steampowered.com/v1", allowed),
    ).not.toThrow();
  });
});
