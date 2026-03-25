import { AllExceptionsFilter } from "../shared/all-exceptions.filter";
import { HttpException, HttpStatus, ArgumentsHost } from "@nestjs/common";

type TestHost = ArgumentsHost & { _response: any };

function makeHost(req: Partial<{ method: string; url: string }> = {}): TestHost {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status, json } as any;
  const request = { method: "GET", url: "/test", ...req };
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
    _response: response,
  } as unknown as TestHost;
}

describe("AllExceptionsFilter", () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it("returns the correct status for an HttpException", () => {
    const host = makeHost({ url: "/games" });
    filter.catch(new HttpException("Not Found", HttpStatus.NOT_FOUND), host);
    expect(host._response.status).toHaveBeenCalledWith(404);
  });

  it("returns 500 for an unknown error", () => {
    const host = makeHost({ url: "/games" });
    filter.catch(new Error("boom"), host);
    expect(host._response.status).toHaveBeenCalledWith(500);
  });

  it("includes the request path in the response", () => {
    const host = makeHost({ url: "/some-path" });
    filter.catch(new HttpException("Forbidden", 403), host);
    const jsonArg = host._response.status.mock.results[0].value.json.mock.calls[0][0];
    expect(jsonArg.path).toBe("/some-path");
  });

  it("includes a timestamp in the response", () => {
    const host = makeHost();
    filter.catch(new HttpException("OK", 200), host);
    const jsonArg = host._response.status.mock.results[0].value.json.mock.calls[0][0];
    expect(jsonArg.timestamp).toBeTruthy();
  });

  it("propagates the HttpException message in the response", () => {
    const host = makeHost();
    filter.catch(new HttpException({ error: "custom" }, 422), host);
    const jsonArg = host._response.status.mock.results[0].value.json.mock.calls[0][0];
    expect(jsonArg.message).toEqual({ error: "custom" });
  });
});
