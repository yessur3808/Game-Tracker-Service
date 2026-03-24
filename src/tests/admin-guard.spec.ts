import { AdminGuard } from "../modules/admin/guard";
import { UnauthorizedException } from "@nestjs/common";

function makeContext(headers: Record<string, string> = {}, adminKey?: string): any {
  const request = {
    headers: { ...headers },
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    _request: request,
  };
}

describe("AdminGuard", () => {
  const guard = new AdminGuard();
  const ORIG_ENV = process.env.ADMIN_API_KEY;

  beforeEach(() => {
    process.env.ADMIN_API_KEY = "secret-key";
  });

  afterEach(() => {
    process.env.ADMIN_API_KEY = ORIG_ENV;
  });

  it("returns true when the correct key is provided", () => {
    const ctx = makeContext({ "x-admin-key": "secret-key" });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("attaches adminActorId to request when authenticated", () => {
    const ctx = makeContext({ "x-admin-key": "secret-key" });
    guard.canActivate(ctx);
    expect(ctx._request.adminActorId).toBe("admin-key-1");
  });

  it("throws UnauthorizedException when key is missing", () => {
    const ctx = makeContext({});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when key is wrong", () => {
    const ctx = makeContext({ "x-admin-key": "wrong-key" });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("throws Error when ADMIN_API_KEY env var is not set", () => {
    delete process.env.ADMIN_API_KEY;
    const ctx = makeContext({ "x-admin-key": "anything" });
    expect(() => guard.canActivate(ctx)).toThrow("Missing ADMIN_API_KEY");
  });
});
