import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./modules/app.module";
import { AllExceptionsFilter } from "./shared/all-exceptions.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow configuring the allowed CORS origin(s) via CORS_ORIGIN env var.
  // Supports a single origin string, a comma-separated list, or "*" for all.
  // Falls back to allowing all origins when unset (convenient for local dev).
  const rawOrigin = process.env.CORS_ORIGIN?.trim();
  let corsOrigin: string | string[] | boolean = true;
  if (rawOrigin && rawOrigin !== "*") {
    const parts = rawOrigin.split(",").map((s) => s.trim()).filter(Boolean);
    corsOrigin = parts.length === 1 ? parts[0] : parts;
  }
  app.enableCors({ origin: corsOrigin });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(`Listening on http://localhost:${port}`);
}
bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
