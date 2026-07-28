# Architecture Decision Records

Each file records one significant decision: the context that forced it, what was chosen, the consequences accepted, and the alternatives rejected with reasons.

Format follows Michael Nygard's ADR template. Records are immutable once accepted — if a decision changes, a new ADR supersedes the old one rather than editing it, so the reasoning history stays intact.

| # | Decision | Status |
|---|---|---|
| [0001](0001-seat-locking-strategy.md) | Seat locking: short pessimistic lock + TTL reservation + lazy expiry | Accepted |
| [0002](0002-seat-state-ownership.md) | Seat state lives on `seats`, not `checkout_seats` | Accepted |
| [0003](0003-modular-monolith.md) | Modular monolith, not microservices | Accepted |
| [0004](0004-caching-scope.md) | Cache the event list, deliberately not the seat map | Accepted |
| [0005](0005-postgresql-over-nosql.md) | PostgreSQL, not a NoSQL store | Accepted |
| [0006](0006-mvp-scope-cuts.md) | MVP scope cuts: organizer role, payments, refunds | Accepted |

## Pending

- **Migration tooling — Knex vs Prisma.** To be decided in Phase 0 and recorded as ADR 0007.

## Reading order

Start with [0001](0001-seat-locking-strategy.md). It is the central decision; 0002 and 0005 exist to support it, and 0003 explains why the architecture keeps it possible.
