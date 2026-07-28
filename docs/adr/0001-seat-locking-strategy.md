# ADR 0001: Seat Locking Strategy — Short Pessimistic Lock + TTL Reservation + Lazy Expiry

## Status

Accepted — 2026-07-28. Decided before implementation; revisit if Phase 3 concurrency tests reveal the model is wrong.

## Context

The core claim of this project is that no seat is ever double-booked or partially booked, even when several users check out overlapping seat sets at the same instant.

Two facts about the domain shape the solution:

1. **Checkout is multi-seat and all-or-nothing.** A user selecting seats A, B, C must get all three or none. A partial success is a product bug, not a degraded outcome.
2. **Checkout spans a human-paced payment step.** From "I want these seats" to "payment confirmed" is minutes, not milliseconds. During that window the seats must be unavailable to everyone else, but the user has not committed yet and may simply walk away.

Point 2 is the one that constrains the design. Whatever mechanism reserves the seats has to survive a long, unpredictable, frequently-abandoned wait.

## Decision

Split the problem into two mechanisms that are often conflated:

**1. Atomic correctness — a short pessimistic lock.**

Checkout initiation opens a transaction, runs `SELECT ... FOR UPDATE` over the requested seat rows **sorted by seat ID**, verifies every one is available, flips them to `locked` with a `lock_expires_at` timestamp, and commits. The transaction lasts milliseconds.

**2. Reservation lifetime — a status + expiry record.**

The hold itself is data (`seats.status = 'locked'`, `seats.lock_expires_at`), not a held database lock. The row lock is released the moment the transaction commits; the reservation outlives it.

**3. Expiry — lazy, with a housekeeping sweep.**

Every query that reads or contends for a seat treats `status = 'locked' AND lock_expires_at < now()` as available, evaluated inside the same transaction that would act on it. A background job additionally rewrites expired rows to `available`, but it is housekeeping — correctness does not depend on it running promptly, or at all.

Confirm re-checks `status = 'locked' AND lock_expires_at > now()` in its own transaction before flipping seats to `booked`.

Lock window defaults to 5 minutes (`CHECKOUT_LOCK_TTL_SECONDS`), overridden to a few seconds under test.

## Consequences

**Positive**

- Database connections are never held across the payment window. A held-open transaction per in-flight checkout would exhaust the connection pool under exactly the traffic this system is built for.
- Sorted lock acquisition means two transactions requesting `[1,2,3]` and `[3,2,1]` acquire in the same order, so one waits instead of deadlocking. Without ordering, `[1,2,3]` vs `[3,4,5]` can deadlock: each holds what the other needs next.
- Crash safety comes free. If the process dies mid-checkout, the reservation is a durable row with an expiry, so it self-heals. A held row lock would vanish with the dead connection, releasing seats early with no record of what happened.
- Lazy expiry makes reclaim instantaneous. A seat is reusable the microsecond it expires, rather than sitting falsely locked until the next sweep tick.
- The confirm-vs-expiry race is closed by construction: the transaction that would double-book is the same one that re-checks expiry.

**Negative**

- The lazy-expiry predicate must appear in *every* query that touches seat availability. Forgetting it in one place silently reintroduces stale-lock bugs. Mitigated by putting seat reads behind a repository method rather than writing ad-hoc queries.
- Writes contend on `seats` rows. Fine at this scale; a venue with tens of thousands of seats and extreme concurrency might need partitioning or a different model.
- Two sources of expiry truth (lazy check + sweep job) must agree. They do here because both use the same predicate, but this is a place a future change could break quietly.

## Alternatives rejected

**Hold `SELECT FOR UPDATE` open for the entire checkout window.**
The naive reading of "lock the seats during checkout," and what the original project plan ambiguously implied. Rejected: it pins a database connection and transaction open for minutes per user. Every other transaction touching those rows blocks for the full duration, deadlock probability scales with hold time, and the pool exhausts under modest concurrency. It also gives no way to express "expires in 5 minutes" — the hold ends when the connection ends, which is not a business rule.

**Optimistic locking (version column, detect conflict, retry).**
Rejected for this domain. Optimistic concurrency wins when conflicts are rare; here conflicts *are* the scenario — popular events mean many users racing for the same seats. Under contention it degrades into repeated failed retries, and the UX is worse: the user completes payment and *then* learns they lost the seat, versus being told upfront and immediately.

**Redis distributed lock (Redlock or similar).**
Rejected as unjustified complexity. It introduces a second source of truth for seat state, and correctness becomes dependent on Redis availability and on the lock TTL matching reality. PostgreSQL already provides exactly the transactional guarantees needed, in the same system that stores the data. Adding a distributed lock across a single-database monolith would be architecture for its own sake.

**Application-level mutex / in-process queue.**
Rejected: correct only while exactly one process runs. It breaks the moment the app is scaled horizontally, which is a constraint no ticketing system can accept. The guarantee belongs where the data is.

**Rely solely on the background job for expiry (no lazy check).**
Rejected: it makes correctness depend on a polling interval. A seat could appear falsely locked for up to one sweep cycle after expiry — visibly broken to any reviewer running the demo — and it opens a race where a sweep and a confirm act on the same checkout simultaneously.

## Notes for future readers

The distinction worth internalising: **a database row lock enforces atomicity, it does not implement a business-level reservation.** Row locks are scoped to a transaction and cannot outlive one. A hold that lasts minutes and expires on a business rule is application state, and belongs in a column.
