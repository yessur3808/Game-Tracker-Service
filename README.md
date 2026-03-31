# Game Tracker Service

[![CI](https://github.com/yessur3808/Game-Tracker-Service/actions/workflows/ci.yml/badge.svg)](https://github.com/yessur3808/Game-Tracker-Service/actions/workflows/ci.yml)

A NestJS + MongoDB service for tracking video game releases across multiple platforms. It maintains a canonical game record enriched with data ingested from Steam, IGDB, Epic Games, PlayStation, Xbox, and Nintendo, and exposes a composed read model through a clean REST API.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
  - [Requirements](#requirements)
  - [Install](#install)
  - [Configure Environment](#configure-environment)
  - [Database Migrations](#database-migrations)
  - [Run](#run)
  - [Docker](#docker)
- [API Reference](#api-reference)
  - [Health](#health)
  - [Public — Games](#public--games)
  - [Admin — Games](#admin--games)
  - [Admin — Manual Sources](#admin--manual-sources)
  - [Admin — Overrides](#admin--overrides)
  - [Admin — Audit Log](#admin--audit-log)
  - [Admin — Ingestion](#admin--ingestion)
- [Data Models](#data-models)
- [Ingestion & Providers](#ingestion--providers)
- [Security](#security)
- [Testing](#testing)
- [Postman Collection](#postman-collection)
- [Environment Variables](#environment-variables)

---

## Features

### Public API
- List games with filtering by platform, category, availability, and sorting options
- Search games by name (case-insensitive, partial match)
- Dedicated endpoints for upcoming and recently-released games
- **Composed read** — every game response merges canonical data + active manual override + manual sources + recomputed `availability`

### Admin API *(requires `X-Admin-Key` header)*
- Create, patch, and delete canonical game records
- Attach, edit, and remove manual sources scoped to different parts of a game record
- Create and toggle field-level overrides (reversible, non-destructive corrections)
- Query a full audit log of all admin and ingestion actions
- Manually trigger the ingestion pipeline

### Ingestion
- Bi-weekly cron job (03:00 UTC on the 1st and 15th of every month)
- Fetches data from **Steam**, **IGDB**, **Epic Games**, **PlayStation Store**, **Xbox**, and **Nintendo eShop**
- Source discovery via IGDB API search and Steam search
- URL validation and link resolution to prevent SSRF

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [NestJS](https://nestjs.com/) v11 |
| Database | [MongoDB](https://www.mongodb.com/) (official Node driver v7) |
| Validation | [Zod](https://zod.dev/) v4 |
| Scheduling | `@nestjs/schedule` (cron) |
| Language | TypeScript 5 |
| Testing | Jest + ts-jest |
| Runtime | Node.js 20 |

---

## Architecture Overview

```
src/
├── main.ts                    # Bootstrap
├── migrations/                # DB migration runner + scripts
└── modules/
    ├── app.module.ts
    ├── config.module.ts       # dotenv / ConfigService
    ├── db.module.ts           # MongoDB connection + index setup
    ├── health/                # GET /health, GET /health/ready
    ├── games/                 # Public read API (composed view)
    ├── admin/                 # Admin write API (canonical CRUD)
    ├── manual-sources/        # Admin CRUD for manual sources
    ├── overrides/             # Admin CRUD for field overrides
    ├── audit/                 # Append-only audit log
    └── ingestion/             # Scheduled ingestion pipeline
        ├── providers/         # Steam, IGDB, Epic, PlayStation, Xbox, Nintendo
        ├── crawler/           # Source discovery + URL resolver
        └── analysis/          # Result normalization
```

**Composed read model** — when a game is fetched through the public API:

1. Load canonical `games` document from MongoDB
2. Merge manual sources (deduplicated by URL, scoped by type)
3. Apply the single enabled `manual_overrides` patch (deep merge; arrays are replaced)
4. Recompute `availability` from the resulting release data

---

## Getting Started

### Requirements

- Node.js 24.13.0 (per `.nvmrc`)
- MongoDB 6+ (local or remote)

### Install

```bash
npm install
```

### Configure Environment

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

```dotenv
# Required
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=game_tracker
ADMIN_API_KEY=change-me
PORT=3000

# Ingestion (optional)
TWITCH_CLIENT_ID=...
TWITCH_CLIENT_SECRET=...
INGESTION_USER_AGENT=GameTrackerBot/1.0 (+contact@example.com)
INGESTION_TIMEOUT_MS=12000
INGESTION_MAX_RETRIES=2
DEFAULT_STORE_REGION=us
DEFAULT_STORE_LANGUAGE=en
```

### Database Migrations

Apply all pending migrations before the first run (and after any upgrade):

```bash
npm run migrate        # apply pending migrations
npm run migrate:down   # rollback the last migration
npm run migrate:status # show applied vs pending migrations
```

Migrations live in `src/migrations/` and are tracked in a `_migrations` collection in MongoDB. Migration `001_initial_schema` creates all required collections and indexes.

### Run

**Development (ts-node):**

```bash
npm run start:dev
```

**Production:**

```bash
npm run build
npm start
```

The server starts on `http://localhost:3000` (or the `PORT` you configured).

### Docker

A multi-stage Dockerfile is included. The production image runs as a non-root user with only production dependencies installed.

```bash
# Build the image
docker build -t game-tracker-service .

# Run (pass env vars as needed)
docker run -p 3000:3000 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017 \
  -e MONGODB_DB=game_tracker \
  -e ADMIN_API_KEY=change-me \
  game-tracker-service
```

---

## API Reference

All responses use JSON. Admin endpoints require the header `X-Admin-Key: <ADMIN_API_KEY>`.

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Liveness check — always returns `{ status: "ok", timestamp }` |
| `GET` | `/health/ready` | None | Readiness check — pings MongoDB; returns 503 if unavailable |

---

### Public — Games

#### `GET /games`

List games with optional filtering.

| Query Param | Type | Description |
|---|---|---|
| `platform` | string | Filter by platform, e.g. `PC`, `PS5`, `Xbox` |
| `categoryType` | string | `full_game` \| `dlc` \| `season` \| `event` \| `update` \| `store_reset` |
| `availability` | string | `upcoming` \| `released` \| `unknown` |
| `sortBy` | string | `updatedAt` (default) \| `releaseDate` \| `releaseDateDesc` \| `name` |
| `limit` | number | 1–200, default 50 |
| `skip` | number | Pagination offset |
| `fields` | string | Comma-separated field projection |

```bash
curl "http://localhost:3000/games?platform=PC&availability=upcoming&sortBy=releaseDate&limit=25"
```

Response:

```json
{
  "generatedAt": "...",
  "schemaVersion": 1,
  "games": [...],
  "pagination": { "skip": 0, "limit": 25, "count": 25, "totalCount": 120 }
}
```

---

#### `GET /games/search`

Full-text search by game name.

| Query Param | Type | Description |
|---|---|---|
| `q` | string | **Required.** Search term |
| `limit` | number | Max results |
| `fields` | string | Field projection |

```bash
curl "http://localhost:3000/games/search?q=elden+ring"
```

---

#### `GET /games/upcoming`

Games with `availability: upcoming`, sorted by release date ascending.

---

#### `GET /games/recently-released`

Games with `availability: released`, sorted by release date descending.

---

#### `GET /games/:id`

Fetch a single composed game by its `id` field.

```bash
curl "http://localhost:3000/games/elden-ring-shadow"
```

Returns `404` if not found.

---

### Admin — Games

All admin endpoints require `X-Admin-Key: <ADMIN_API_KEY>`.

#### `POST /admin/games`

Create a canonical game record.

```json
{
  "game": {
    "id": "my-game",
    "name": "My Game",
    "category": { "type": "full_game" },
    "platforms": ["PC"]
  },
  "reason": "Initial entry"
}
```

#### `PATCH /admin/games/:id`

Directly patch a canonical game record.

> **Tip:** Prefer creating an override when you want a reversible, auditable correction to ingested data.

```json
{
  "patch": { "availability": "released" },
  "reason": "Correcting availability"
}
```

#### `DELETE /admin/games/:id`

Delete a game and all its associated data.

```json
{ "reason": "Duplicate entry" }
```

#### `GET /admin/games/:id/overrides`

List all overrides attached to a game.

#### `GET /admin/games/:id/manual-sources`

List all manual sources attached to a game.

---

### Admin — Manual Sources

#### `POST /admin/games/:id/manual-sources`

Attach a manual source to a game.

```json
{
  "source": {
    "type": "platform_store",
    "name": "Steam Store",
    "url": "https://store.steampowered.com/app/12345",
    "isOfficial": true,
    "reliability": "high"
  },
  "scope": "general",
  "reason": "Adding Steam link"
}
```

`scope` options: `general` | `release` | `seasonWindow` | `media`

#### `PATCH /admin/manual-sources/:sourceId`

Update an existing manual source.

#### `DELETE /admin/manual-sources/:sourceId`

Remove a manual source.

---

### Admin — Overrides

An override is a `Partial<Game>` patch applied at read time. Only **one** override can be enabled per game at a time — enabling a new one automatically disables the previous one.

#### `POST /admin/games/:id/overrides`

Create an override (optionally enable it immediately).

```json
{
  "patch": {
    "availability": "upcoming",
    "release": { "status": "delayed" }
  },
  "enabled": true,
  "reason": "Game delayed — overriding ingested release status"
}
```

#### `PATCH /admin/overrides/:overrideId`

Update or toggle an existing override.

```json
{ "enabled": false, "reason": "Delay resolved — no longer needed" }
```

---

### Admin — Audit Log

#### `GET /admin/audit`

Query the audit log (entries expire after 180 days).

| Query Param | Type | Description |
|---|---|---|
| `entityType` | string | Filter by entity type, e.g. `game`, `manual_source`, `override` |
| `entityId` | string | Filter by entity ID |
| `limit` | number | 1–200, default 50 |

```bash
curl -H "X-Admin-Key: change-me" \
  "http://localhost:3000/admin/audit?entityType=game&entityId=elden-ring-shadow&limit=20"
```

---

### Admin — Ingestion

#### `POST /ingest/run`

Trigger the full ingestion pipeline immediately (runs in the background).

```bash
curl -X POST -H "X-Admin-Key: change-me" http://localhost:3000/ingest/run
```

Response: `202 Accepted` with `{ "message": "Ingestion run started" }`.

Check the `ingestion_runs` collection in MongoDB for run status and results.

---

## Data Models

### Game

```typescript
{
  id: string                   // unique slug, e.g. "elden-ring-shadow"
  name: string
  title?: string               // canonical display title
  description?: string
  category: {
    type: "full_game" | "dlc" | "season" | "event" | "update" | "store_reset" | "other"
    subtype?: string
    franchise?: string
    label?: string
    gameId?: string            // parent game id for DLC/seasons
    seasonNumber?: number
    seasonName?: string
  }
  platforms: string[]          // e.g. ["PC", "PS5", "Xbox Series X"]
  availability: "upcoming" | "released" | "cancelled" | "unknown"  // derived at read time
  release: {
    status: "announced" | "upcoming" | "released" | "delayed" | "canceled" | "unknown"
            | "recurring_daily" | "recurring_weekly"
    confidence: "official" | "likely" | "rumor" | "unknown"
    isOfficial: boolean
    dateISO?: string           // ISO 8601 date; required when status = "released"
    datePrecision?: "day" | "month" | "quarter" | "year" | "unknown"
    announced_window?: { label: string, year?: number, quarter?: number, month?: number }
    timeUTC?: string           // "HH:MM"; required for recurring statuses
    dayOfWeekUTC?: 0 | 1 | 2 | 3 | 4 | 5 | 6  // 0 = Sunday; required for recurring_weekly
    sources: Source[]
  }
  seasonWindow?: {
    current?: {
      startISO?: string
      endISO?: string
      label?: string
      isOfficial?: boolean
      confidence?: "confirmed" | "likely" | "estimate" | "unknown"
      sources?: Source[]
    }
  }
  studio?: {
    name: string | null
    type: "developer" | "publisher" | "developer_publisher" | "unknown"
    website?: string
    parentCompany?: string
    description?: string
  }
  media?: {
    cover?: { url: string, width?: number, height?: number }
    screenshots?: { url: string }[]
    trailerUrl?: string
  }
  coverUrl?: string            // legacy; prefer media.cover
  genres?: string[]            // e.g. ["Action", "RPG"]
  tags?: string[]
  popularityTier?: string
  popularityRank?: number
  sources: Source[]
  externalIds?: {
    steam?: number        // Steam app ID
    igdb?: number         // IGDB game ID
    epic?: string         // Epic Games slug
    playstation?: string  // PlayStation CPSID
    xbox?: string         // Xbox ID
    nintendo?: string     // Nintendo ID
  }
  updatedAt?: string           // ISO 8601
  lastIngestedAt?: string      // ISO 8601
}
```

### Source

```typescript
{
  type: "official_site" | "press_release" | "platform_store" | "youtube"
        | "twitter_x" | "discord" | "gaming_news" | "gaming_blog"
        | "forum" | "reddit" | "other"
  name: string
  url?: string                 // optional (e.g. verbal press releases have no URL)
  isOfficial: boolean
  reliability: "high" | "medium" | "low" | "unknown"
  claim?: string               // max 1000 chars
  excerpt?: string             // max 2000 chars
  authorHandle?: string        // for social sources
  credibilityScore?: number    // 1–100, curator-assigned
  retrievedAt?: string         // ISO 8601
  lastCheckedAt?: string       // ISO 8601
  checkCount?: number
}
```

### Manual Source

Stored in the `manual_sources` collection:

```typescript
{
  _id: ObjectId
  gameId: string
  scope: "general" | "release" | "seasonWindow" | "media"
  source: Source
  createdAt: string            // ISO 8601
  updatedAt: string            // ISO 8601
}
```

### Manual Override

Stored in the `manual_overrides` collection. A partial unique index enforces only one enabled override per game at a time.

```typescript
{
  _id: ObjectId
  gameId: string
  enabled: boolean
  patch: Partial<Game>         // applied via deep merge at read time (arrays are replaced)
  reason?: string
  createdAt: string            // ISO 8601
  updatedAt: string            // ISO 8601
}
```

### Audit Entry

Stored in `audit_log` with a **180-day TTL index**.

```typescript
{
  _id: ObjectId
  at: string                   // ISO 8601
  action: string               // e.g. "game.create", "override.patch"
  actor: { type: "admin" | "ingestion" | "system" }
  entity: { type: string, id: string }
  before?: any                 // snapshot before change
  after?: any                  // snapshot after change
  request?: { ip?: string, userAgent?: string, requestId?: string }
}
```

---

## Ingestion & Providers

The ingestion pipeline runs automatically at **03:00 UTC on the 1st and 15th** of each month, and can also be triggered on-demand via `POST /ingest/run`.

### Providers

| Provider | Data Source | External ID field |
|---|---|---|
| **Steam** | Steam API (`appdetails`) | `externalIds.steam` |
| **IGDB** | IGDB API *(Twitch credentials required)* | `externalIds.igdb` |
| **Epic Games** | Epic Games Store (HTML scrape) | `externalIds.epic` |
| **PlayStation** | PlayStation Store (HTML scrape) | `externalIds.playstation` |
| **Xbox** | Microsoft Store (HTML scrape) | `externalIds.xbox` |
| **Nintendo** | Nintendo eShop (HTML scrape) | `externalIds.nintendo` |

Each provider returns a `ProviderResult` containing: name, release text/date, platforms, cover URL, description, price, and genres.

### Source Discovery (Crawler)

The `SourceFinderService` automatically discovers new game URLs by:

- Searching IGDB by game name and extracting linked website URLs
- Searching the Steam catalog by game name

Discovered URLs are resolved by `LinkResolverService` (HEAD request, HTTPS-only validation) before being recorded.

### Pipeline Steps

1. Load all games from the `games` collection
2. For each game, call all applicable providers based on known `externalIds`
3. Run source discovery for games missing provider links
4. Normalize and merge provider results
5. Upsert changes into the `games` collection, updating `lastIngestedAt`
6. Record run metadata (start time, status, game counts) in `ingestion_runs`

---

## Security

Admin endpoints are protected by a static API key passed as a request header:

```
X-Admin-Key: <ADMIN_API_KEY>
```

Additional security hardening in place:

- **HTTPS enforcement** — all provider HTTP requests require HTTPS URLs
- **SSRF protection** — open redirects are followed manually and re-validated; hostname matching uses exact or suffix comparison (not substring) to prevent spoofed hostnames
- **Non-root Docker container** — the production image runs as an unprivileged `appuser`
- **Minimal production image** — devDependencies are excluded from the final Docker stage

> **Note for production deployments:** The static API key guard is intentionally simple. Consider replacing it with JWT/OIDC, adding rate limiting, and storing secrets in a vault.

---

## Testing

Tests use **Jest** with **ts-jest** and run serially (`--runInBand`).

```bash
npm test                 # run all tests
npm run test:watch       # watch mode
npm run test:coverage    # generate coverage report
```

Test files live in `src/tests/` and cover:

- Admin guard authentication
- Global exception filter
- Games, manual sources, overrides, and audit services
- Zod schema validation
- HTML parsing utilities
- HTTP retry and URL utilities
- Date parser
- Provider result normalizer
- Source analyzer

A pre-push git hook (`.githooks/pre-push`) automatically runs `npm test` before every `git push`.

CI runs the full build and test suite on Node.js 20 for every push and pull request.

---

## Postman Collection

A ready-to-use Postman collection is included at [`postman/Game-Tracker-Service.postman_collection.json`](postman/Game-Tracker-Service.postman_collection.json).

### Import

1. Open Postman and click **Import**.
2. Select the file `postman/Game-Tracker-Service.postman_collection.json`.
3. The collection will appear with all folders and requests pre-configured.

### Collection variables

After importing, set these variables in the collection's **Variables** tab (or in an environment):

| Variable | Default | Description |
|---|---|---|
| `baseUrl` | `http://localhost:3000` | URL of your running instance |
| `adminApiKey` | `change-me` | Value of `ADMIN_API_KEY` from your `.env` |
| `gameId` | `fortnite-ch6-s3` | Game ID used in parameterised requests (auto-updated on create) |
| `sourceId` | *(empty)* | Manual source `_id` (auto-updated on create) |
| `overrideId` | *(empty)* | Override `_id` (auto-updated on create) |

### Recommended workflow

1. **Health** — confirm the service is up and MongoDB is reachable.
2. **Admin > Create Game** — creates a game and saves its `id` to `gameId`.
3. **Public > Get Game by ID** — verify the composed view.
4. **Admin > Add Manual Source** — attach a source; `sourceId` is saved automatically.
5. **Admin > Create Override (enabled)** — apply a patch; `overrideId` is saved automatically.
6. **Public > Get Game by ID** — observe the override applied to the response.
7. **Admin > Patch Override — disable** — revert to canonical data.
8. **Admin > Trigger Ingestion Run** — fire the pipeline on demand.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGODB_URI` | ✅ | — | MongoDB connection string |
| `MONGODB_DB` | ✅ | — | Database name |
| `ADMIN_API_KEY` | ✅ | — | API key for all admin endpoints |
| `PORT` | — | `3000` | HTTP server port |
| `TWITCH_CLIENT_ID` | — | — | Twitch/IGDB API client ID (required for IGDB provider) |
| `TWITCH_CLIENT_SECRET` | — | — | Twitch/IGDB API client secret (required for IGDB provider) |
| `INGESTION_USER_AGENT` | — | `GameTrackerBot/1.0 (+contact@example.com)` | User-Agent header sent with ingestion HTTP requests |
| `INGESTION_TIMEOUT_MS` | — | `12000` | HTTP request timeout in milliseconds |
| `INGESTION_MAX_RETRIES` | — | `2` | Number of HTTP retries on transient failure |
| `DEFAULT_STORE_REGION` | — | `us` | Region code for store queries (e.g. `us`, `eu`) |
| `DEFAULT_STORE_LANGUAGE` | — | `en` | Language code for store queries |
