# ADR 0005: PostgreSQL, Not a NoSQL Store

## Status

Accepted — 2026-07-28.

## Context

Node.js projects commonly reach for MongoDB by default. Choosing PostgreSQL here is deliberate and follows from the domain, not from familiarity.

## Decision

**PostgreSQL** as the single datastore for all application state — users, events, venues, seats, checkouts, bookings.

Redis appears only as an optional cache for one endpoint (see [ADR 0004](0004-caching-scope.md)), never as a source of truth.

## Consequences

**Positive**

- **Row-level locking with `SELECT ... FOR UPDATE`** is the mechanism the entire locking strategy rests on ([ADR 0001](0001-seat-locking-strategy.md)). It gives explicit, ordered, multi-row pessimistic locks inside a transaction.
- **Multi-row ACID transactions.** Locking five seats atomically is one transaction that either commits entirely or rolls back entirely. This is the no-partial-booking guarantee, obtained directly from the database rather than reconstructed in application code.
- **Referential integrity** via foreign keys, and **uniqueness** via composite constraints (`event_id + seat_label`), giving a second line of defence beneath the service-layer rules.
- The data is unambiguously relational: users have bookings, events have seats, checkouts reference both. Modelling it relationally requires no contortion.

**Negative**

- Horizontal write scaling is harder than with a sharded document store. Not a constraint at this scale, and vertical scaling plus read replicas would carry this system far past its requirements.
- Schema changes require migrations. Arguably a benefit for a project whose subject is correctness under constraints.

## Alternatives rejected

**MongoDB.**
Rejected on the central requirement. Multi-document transactions do exist (4.0+ on replica sets), but the concurrency model is a poor fit: there is no direct equivalent of `SELECT ... FOR UPDATE` for taking ordered pessimistic locks across a set of documents. The idiomatic approaches are optimistic (`findAndModify` with a version check, retry on conflict) — rejected for this domain in [ADR 0001](0001-seat-locking-strategy.md) because conflicts here are the normal case, not the exception.

Modelling seats as embedded subdocuments of an event would make the whole event document the unit of contention, serialising every checkout for an event. Modelling them as a separate collection reproduces a relational schema in a store that gives weaker guarantees for it.

**Redis as primary store.**
Rejected outright. Durability is configurable rather than default, and bookings are exactly the kind of data that must not be lost on restart. Redis is well-suited to the *cache* role it holds here and nothing more.

**MySQL.**
A legitimate choice — it also supports `SELECT ... FOR UPDATE` and ACID transactions. PostgreSQL preferred for stricter default isolation behaviour, richer type support including native enums used for `seat_status`, and better-defined semantics around `SKIP LOCKED` / `NOWAIT` should the locking strategy need refinement. This is a preference, not a correctness argument.

**SQLite.**
Rejected: writer-level locking rather than row-level. Concurrent checkout requests would serialise across the entire database, making the concurrency behaviour this project demonstrates impossible to exercise meaningfully.

## Notes for future readers

The framing that matters: the database was chosen by working backwards from the hardest requirement. "No double-booking under concurrent multi-seat load" demands ordered pessimistic row locks inside a multi-row transaction, and that requirement eliminates most of the alternatives before preference enters the picture.
