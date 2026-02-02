import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & any>();
    const key = req.headers["x-admin-key"];

    const expected = process.env.ADMIN_API_KEY;
    if (!expected) throw new Error("Missing ADMIN_API_KEY");

    if (!key || key !== expected) {
      throw new UnauthorizedException("Invalid admin key");
    }

    // attach actor identity for audit
    (req as any).adminActorId = "admin-key-1";
    return true;
  }
}
