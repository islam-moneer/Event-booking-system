# Event Ticket Booking Platform

A backend platform for discovering events, selecting seats, and booking tickets — built so that **no seat is ever double-booked or partially booked**, even when multiple users check out overlapping seat sets at the same instant.

> **Status: in development.** Architecture and design decisions are complete and documented; implementation is in progress. Sections marked _TBD_ are filled in as each phase lands.

## The problem this solves

Concurrent seat booking is a genuine correctness problem, not a CRUD app with extra steps:

- **Multi-seat checkout is all-or-nothing.** A user requesting seats A, B, C must get all three or none. A partial success is a bug, not a degraded result.
- **Checkout spans a human-paced payment step.** From "I want these seats" to "payment confirmed" is minutes, and users abandon carts constantly. The seats must be held during that window, then released automatically if nothing happens.
- **Popular events mean contention is the normal case**, not a rare edge. The design has to be correct when many users race for the same seats — which rules out approaches that assume conflicts are unlikely.

## How it works

Reservation is split into two mechanisms that are commonly conflated:

**Atomic correctness — a short pessimistic lock.**
Checkout opens a transaction, runs `SELECT ... FOR UPDATE` over the requested seats **sorted by seat ID** (consistent ordering prevents deadlock between overlapping requests), verifies every seat is available, flips them to `locked` with an expiry, and commits. The transaction lasts milliseconds.

**Reservation lifetime — a status + expiry column.**
The hold is *data*, not a held database lock. Row locks cannot outlive a transaction, so a hold that lasts five minutes and expires on a business rule belongs in a column. This also means no database connection is pinned open during payment, and a crashed process self-heals rather than releasing seats silently.

**Expiry — lazy, with a housekeeping sweep.**
Every query contending for a seat treats an expired lock as available, evaluated inside the same transaction that would act on it. A seat is reclaimable the instant it expires rather than at the next background tick, and the confirm-vs-expiry race closes by construction. A background job also sweeps expired rows, but correctness does not depend on it running.

Full reasoning, including the alternatives rejected and why: **[`docs/adr/`](docs/adr/)**.

## Architecture decisions

Each record states the context, the decision, consequences accepted, and alternatives rejected with reasons.

| # | Decision |
|---|---|
| [0001](docs/adr/0001-seat-locking-strategy.md) | Seat locking: short pessimistic lock + TTL reservation + lazy expiry |
| [0002](docs/adr/0002-seat-state-ownership.md) | Seat state lives on `seats`, not `checkout_seats` |
| [0003](docs/adr/0003-modular-monolith.md) | Modular monolith, not microservices |
| [0004](docs/adr/0004-caching-scope.md) | Cache the event list, deliberately not the seat map |
| [0005](docs/adr/0005-postgresql-over-nosql.md) | PostgreSQL, not a NoSQL store |
| [0006](docs/adr/0006-mvp-scope-cuts.md) | MVP scope cuts: organizer role, payments, refunds |
| [0007](docs/adr/0007-express-knex-vitest.md) | Express, Knex, and Vitest — why not Prisma |

## Tech stack

| | |
|---|---|
| Runtime | Node.js 22+, TypeScript, native ESM |
| HTTP | Express 5 — native async error propagation ([ADR 0007](docs/adr/0007-express-knex-vitest.md)) |
| Database | PostgreSQL — chosen for `SELECT ... FOR UPDATE` and multi-row ACID transactions ([ADR 0005](docs/adr/0005-postgresql-over-nosql.md)) |
| Data access | Knex — query builder and migrations; keeps the locking SQL explicit rather than behind an ORM ([ADR 0007](docs/adr/0007-express-knex-vitest.md)) |
| Cache | Redis — event list only, TTL-based ([ADR 0004](docs/adr/0004-caching-scope.md)) |
| Real-time | WebSocket, for live seat map updates |
| Auth | JWT, bcrypt password hashing |
| Testing | Vitest + Supertest, integration tests against a real PostgreSQL instance |
| Architecture | Modular monolith, Controller → Service → Repository ([ADR 0003](docs/adr/0003-modular-monolith.md)) |

## Deliberately out of scope

Cut so the concurrency work gets the time it needs — see [ADR 0006](docs/adr/0006-mvp-scope-cuts.md) for the reasoning on each:

- Real payment gateway (mocked — the interesting engineering is the reservation window around payment, not the SDK)
- Organizer role and event-creation API (events are seed-provisioned)
- Refunds, cancellations, waitlists
- Admin dashboard UI (API-only)

## Getting started

**Prerequisites**

- Node.js 22 or later (`node --version`)
- Docker with Compose — PostgreSQL 17 and Redis 7 run as containers; no local install needed

**1. Install dependencies**

```bash
npm install
```

**2. Start PostgreSQL and Redis**

```bash
docker compose up -d
```

Host ports are deliberately non-default — Postgres on **5433** and Redis on **6380** — so the containers don't collide with a locally installed instance. Both databases (`ebs_dev` and `ebs_test`) are created on first start by `docker/init-test-db.sql`.

Wait for both to report healthy:

```bash
docker compose ps
```

**3. Configure the environment**

```bash
cp .env.example .env
cp .env.test.example .env.test
```

The defaults match `docker-compose.yml` and work as-is. Two values are worth knowing:

- `CHECKOUT_LOCK_TTL_SECONDS` — how long a checkout holds its seats before the lock is treated as expired. 300 in `.env`; **2** in `.env.test`, because the expiry and lazy-reclaim tests have to watch a lock actually expire within a test run.
- `JWT_SECRET` — a development placeholder. Replace it for any real deployment.

**4. Run migrations**

```bash
npm run migrate
```

The test database migrates itself — `tests/global-setup.ts` runs migrations before the suite, so `npm test` needs no separate step.

**5. Start the server**

```bash
npm run dev     # tsx watch, restarts on change
```

Production build: `npm run build && npm start`.

**Verify the setup**

```bash
curl -X POST http://localhost:3000/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"correct-horse-battery"}'
```

A `201` with a user object and no `password` field means the stack is wired end to end.

**Other commands**

| | |
|---|---|
| `npm test` | Full suite (see [Running the tests](#running-the-tests)) |
| `npm run migrate:rollback` | Undo the last migration batch |
| `npm run migrate:status` | Show applied and pending migrations |
| `npm run migrate:make <name>` | Create a new migration |
| `npm run seed` | Run seed scripts — events and seat maps (Phase 2) |
| `npm run lint` / `npm run format` | ESLint / Prettier |

## Running the tests

**Prerequisites:**
- PostgreSQL and Redis running via `docker compose up -d`
- `.env.test` present (`cp .env.test.example .env.test`). The `ebs_test` database itself is created on first container start by `docker/init-test-db.sql`.
- Note that `CHECKOUT_LOCK_TTL_SECONDS` is intentionally set to seconds (not minutes) — expiry and lazy-reclaim tests need locks that actually expire within a test run.

**Execution:**
- Migrations run automatically via `tests/global-setup.ts` before tests start — no manual migrate step needed.
- Full suite: `npm test`
- Watch mode: `npm run test:watch`
- Single file: `npx cross-env NODE_ENV=test vitest run tests/integration/auth.routes.test.ts`

**Safety:**
The test suite refuses to run against any database whose name does not end in `_test`.

The test suite is the point of this project. It includes explicit concurrency tests proving:

- Two simultaneous checkouts for the same seat → exactly one succeeds, cleanly
- Overlapping seat sets (`[1,2,3]` vs `[3,4,5]`) → one winner, no deadlock, no partial booking
- A confirm racing an expiry reclaim → exactly one outcome wins, never both

## API documentation

_TBD — Postman / Swagger collection added in Phase 6._
