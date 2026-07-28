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

## Tech stack

| | |
|---|---|
| Runtime | Node.js |
| Database | PostgreSQL — chosen for `SELECT ... FOR UPDATE` and multi-row ACID transactions ([ADR 0005](docs/adr/0005-postgresql-over-nosql.md)) |
| Cache | Redis — event list only, TTL-based ([ADR 0004](docs/adr/0004-caching-scope.md)) |
| Real-time | WebSocket, for live seat map updates |
| Auth | JWT |
| Architecture | Modular monolith, Controller → Service → Repository ([ADR 0003](docs/adr/0003-modular-monolith.md)) |

_HTTP framework and migration tooling: TBD, recorded as an ADR once chosen._

## Deliberately out of scope

Cut so the concurrency work gets the time it needs — see [ADR 0006](docs/adr/0006-mvp-scope-cuts.md) for the reasoning on each:

- Real payment gateway (mocked — the interesting engineering is the reservation window around payment, not the SDK)
- Organizer role and event-creation API (events are seed-provisioned)
- Refunds, cancellations, waitlists
- Admin dashboard UI (API-only)

## Getting started

_TBD — filled in during Phase 0 setup. Will cover:_

- _Prerequisites (Node version, PostgreSQL, Redis)_
- _Install, environment configuration (`.env`, including `CHECKOUT_LOCK_TTL_SECONDS`), database creation_
- _Running migrations and the seed script_
- _Starting the server_

## Running the tests

_TBD — filled in during Phase 1._

The test suite is the point of this project. It includes explicit concurrency tests proving:

- Two simultaneous checkouts for the same seat → exactly one succeeds, cleanly
- Overlapping seat sets (`[1,2,3]` vs `[3,4,5]`) → one winner, no deadlock, no partial booking
- A confirm racing an expiry reclaim → exactly one outcome wins, never both

## API documentation

_TBD — Postman / Swagger collection added in Phase 6._
