# ADR 0002: Seat State Lives on `seats`, Not `checkout_seats`

## Status

Accepted — 2026-07-28.

## Context

A seat's availability could plausibly be modelled in either of two places:

- On the **`seats`** table — each seat row carries its own status and expiry.
- On **`checkout_seats`** — the join rows linking a checkout to the seats it reserved carry the status, and a seat is "taken" if some active `checkout_seats` row references it.

The two readings appeared in different parts of the original planning documents, which is how this ambiguity was caught before any code was written. Left unresolved, it would have surfaced mid-implementation as a rewrite of the locking logic.

## Decision

**`seats` is the authoritative source of truth for seat state**, carrying:

- `status` — enum: `available` | `locked` | `booked`
- `lock_expires_at` — timestamp, null unless locked
- `current_checkout_id` — nullable FK, which checkout holds it

**`checkout_seats` is a pure join table** (`checkout_id`, `seat_id`) recording membership and serving as booking history. It carries no independent status.

## Consequences

**Positive**

- The row that gets locked *is* the row that represents the contended resource. `SELECT ... FOR UPDATE` on `seats` is directly meaningful.
- Sorting by `seats.id` for deadlock-free lock ordering (see [ADR 0001](0001-seat-locking-strategy.md)) is well-defined, because seat rows exist before any checkout does.
- Reading a seat map is a single-table scan with no joins or subqueries against active checkouts.
- One place to look when debugging "why is this seat unavailable."

**Negative**

- Seat state is denormalised relative to checkouts: the same fact is implied by both `seats.current_checkout_id` and the `checkout_seats` rows. They can drift if a write path updates one without the other. Mitigated by confining all seat transitions to a single service-layer method.
- `seats` becomes a hot write table. Acceptable at this scale.

## Alternatives rejected

**Status on `checkout_seats`, seat availability derived by query.**

Rejected, and the reason is the decisive one: **for a brand-new checkout, the `checkout_seats` rows do not exist yet.** There is nothing to lock. Two concurrent checkouts for the same seat would each `INSERT` their own join rows, lock disjoint sets of rows, find no conflict, and both succeed — the exact double-booking this project exists to prevent.

Making it work would require locking something else anyway (the seat row, or a table-level lock, or a unique partial index catching the collision after the fact). At that point the seat row is already the contention point, so the status may as well live there.

A unique partial index on `checkout_seats (seat_id) WHERE status = 'active'` *could* enforce single-occupancy at the database level. Rejected because it pushes the guarantee entirely into a constraint violation — the application learns it lost only by catching an integrity error, which makes all-or-nothing multi-seat semantics and clean error messaging awkward. It also conflicts with NFR5 (business rules enforced at the service layer, not only by DB constraints).

**Both — status on `seats` *and* on `checkout_seats`.**
Rejected as two sources of truth for one fact, with no mechanism keeping them consistent. Strictly worse than either single choice.

**Seat state in Redis, `seats` as cold storage.**
Rejected: correctness would depend on cache availability, and it splits the transactional boundary across two systems. See [ADR 0004](0004-caching-scope.md) for the general position on caching mutable state here.

## Notes for future readers

General principle: **lock the row that represents the contended resource, and put the contended state on that row.** If the state lives on rows that don't exist until the contending operation creates them, there is nothing to serialise against, and concurrent writers will not see each other.
