# Game Tracker Service (NestJS + MongoDB)

A small NestJS service that stores a canonical “game” record, plus:
- **Manual sources** (URLs/claims you attach to a game)
- **Manual overrides** (admin patches that compose on top of canonical data)
- **Audit log** for admin actions and ingestion upserts
- A scheduled **bi-monthly-ish cron stub** (1st + 15th @ 03:00 UTC) to plug ingestion into later

## Tech stack
- NestJS
- MongoDB (official driver)
- Zod (validation)
- @nestjs/schedule (cron)

---

## Features

### Public API
- `GET /games` — list games (filtered)
- `GET /games/:id` — returns the **composed** view:
  - canonical game
  - + manual sources (deduped + optionally scoped into release/seasonWindow)
  - + enabled manual override patch
  - + derived `availability`

### Admin API (requires `X-Admin-Key`)
- Create/patch canonical games
- Create/patch/delete manual sources
- Create/patch overrides (only one enabled override per game)
- Query audit logs

---

## Setup

### 1) Requirements
- Node.js 18+
- MongoDB running locally or accessible via URI

### 2) Install
```bash
npm install
```


### 3) Configure environment
Create .env:
```bash
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=game_tracker
ADMIN_API_KEY=change-me
PORT=3000
```



### 4) Run
Development:
```bash
npm run start:dev
```

Build + run:
```bash
npm run build
node dist/main.js
```

Server listens on:

`http://localhost:3000`





## Security model (admin)

Admin endpoints require a static key:
-  `Header: X-Admin-Key: <ADMIN_API_KEY>`
Important: This is intentionally simple for a starter project. For production:

- [x] Use real auth (JWT/OIDC)
- [x] Add rate limiting
- [x] Store secrets in a vault
- [x] Add request logging + structured logging




## API overview

### Public
#### List games
`GET /games`

Optional query params:

- `platform (e.g. PC)`
- `categoryType (e.g. full_game, dlc, season, event, update, store_reset)`
- `availability (upcoming|released|unknown)`
- `limit (1–200)`


Example:
```bash
curl "http://localhost:3000/games?platform=PC&availability=upcoming&limit=25"
```

#### Get game (composed)
`GET /games/:id`

Example:
```bash
curl "http://localhost:3000/games/elden-ring-shadow"
```


### Admin (requires X-Admin-Key)
#### Create a game (canonical)
`POST /admin/games`

#### Patch a game (canonical)
`PATCH /admin/games/:id`

Prefer overrides when you want a reversible/admin-traceable correction to ingested data.

#### Add manual source
`POST /admin/games/:id/manual-sources`

#### Patch manual source
`PATCH /admin/manual-sources/:sourceId`


#### Delete manual source
`DELETE /admin/manual-sources/:sourceId`


#### Create override (and optionally enable)
`POST /admin/games/:id/overrides`

Rules:
- Only one enabled override per game (enforced by a partial unique index).
- Creating an enabled override automatically disables the previous enabled override.

#### Patch override
`PATCH /admin/overrides/:overrideId`


#### Audit log
`GET /admin/audit?entityType=game&entityId=<id>&limit=50`



### Data model (high level)
#### Canonical game
Stored in games with:

- `id`, `name`
- `category`, `platforms`
- `release` (status/confidence/sources)
- `sources` (general sources)
- `timestamps`



#### Manual source
Stored in `manual_sources` with:

- `gameId`
- `scope (general|release|seasonWindow|media)`
- `source object` (url, isOfficial, reliability, claim, etc.)


#### Manual override
Stored in `manual_overrides` with:

- `gameId`
- `enabled`
- `patch` (`Partial<Game>`) applied at read time




#### Composed read
When you request a game via public endpoints, the service:

1. Loads canonical games doc
2. Adds manual sources (dedupe by URL)
3. Applies enabled manual override patch (deep merge, arrays replaced)
4. Recomputes availability


## Cron / ingestion
A starter cron job runs at:

- 03:00 UTC on the 1st and 15th
See:

`src/modules/ingestion/ingestion.service.ts`
This is a placeholder. For a true “every 14 days” cadence, store lastRunAt in the DB and run daily to decide if it’s time.


