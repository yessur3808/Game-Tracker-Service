import { fetchTextWithRetry, fetchJsonWithRetry, ProviderHttpError } from "../modules/ingestion/providers/http.util";

function makeResponse(
  status: number,
  body: string,
  headers: Record<string, string> = {},
  url = "https://example.com/",
): Response {
  const headerMap = new Headers(headers);
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: headerMap,
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("fetchTextWithRetry", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns body text on a 200 response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(makeResponse(200, "hello world"));
    const text = await fetchTextWithRetry("https://example.com/", { maxRetries: 0 });
    expect(text).toBe("hello world");
  });

  it("throws ProviderHttpError on a non-retryable 4xx", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(makeResponse(404, "not found"));
    await expect(fetchTextWithRetry("https://example.com/", { maxRetries: 0 })).rejects.toBeInstanceOf(ProviderHttpError);
  });

  it("retries on 429 (rate limit) and succeeds on second attempt", async () => {
    const mockFetch = jest.fn()
      .mockResolvedValueOnce(makeResponse(429, "rate limited"))
      .mockResolvedValueOnce(makeResponse(200, "ok"));
    global.fetch = mockFetch;

    const text = await fetchTextWithRetry("https://example.com/", { maxRetries: 1, timeoutMs: 5000 });
    expect(text).toBe("ok");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries on 500 and throws after exhausting retries", async () => {
    global.fetch = jest.fn().mockResolvedValue(makeResponse(500, "server error"));
    await expect(
      fetchTextWithRetry("https://example.com/", { maxRetries: 1, timeoutMs: 5000 }),
    ).rejects.toBeInstanceOf(ProviderHttpError);
  });

  it("follows a single redirect to HTTPS target", async () => {
    const mockFetch = jest.fn()
      .mockResolvedValueOnce(makeResponse(301, "", { location: "https://example.com/final" }))
      .mockResolvedValueOnce(makeResponse(200, "final body"));
    global.fetch = mockFetch;

    const text = await fetchTextWithRetry("https://example.com/start", { maxRetries: 0 });
    expect(text).toBe("final body");
  });

  it("blocks redirects to HTTP targets", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(
      makeResponse(301, "", { location: "http://evil.com/page" }),
    );
    await expect(
      fetchTextWithRetry("https://example.com/", { maxRetries: 0 }),
    ).rejects.toBeInstanceOf(ProviderHttpError);
  });

  it("throws when too many redirects are followed", async () => {
    // Always returns 302 → same location (loop)
    global.fetch = jest.fn().mockResolvedValue(
      makeResponse(302, "", { location: "https://example.com/loop" }),
    );
    await expect(
      fetchTextWithRetry("https://example.com/loop", { maxRetries: 0, maxRedirects: 2 }),
    ).rejects.toBeInstanceOf(ProviderHttpError);
  });

  it("throws when redirect has no Location header", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(makeResponse(301, ""));
    await expect(
      fetchTextWithRetry("https://example.com/", { maxRetries: 0 }),
    ).rejects.toBeInstanceOf(ProviderHttpError);
  });

  it("calls validateRedirectUrl hook and allows blocking redirects", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(
      makeResponse(301, "", { location: "https://example.com/blocked" }),
    );
    const validator = jest.fn().mockImplementation((url: string) => {
      if (url.includes("blocked")) throw new Error("blocked by validator");
    });

    await expect(
      fetchTextWithRetry("https://example.com/start", { maxRetries: 0, validateRedirectUrl: validator }),
    ).rejects.toThrow("blocked by validator");
    expect(validator).toHaveBeenCalledWith("https://example.com/blocked");
  });
});

describe("fetchJsonWithRetry", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("parses JSON response", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(makeResponse(200, '{"name":"Elden Ring"}'));
    const data = await fetchJsonWithRetry<{ name: string }>("https://example.com/", { maxRetries: 0 });
    expect(data.name).toBe("Elden Ring");
  });

  it("throws SyntaxError on invalid JSON body", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(makeResponse(200, "not json"));
    await expect(fetchJsonWithRetry("https://example.com/", { maxRetries: 0 })).rejects.toThrow(SyntaxError);
  });
});
