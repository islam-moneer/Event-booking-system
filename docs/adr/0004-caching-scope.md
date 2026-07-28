# ADR 0004: Cache the Event List, Deliberately Do Not Cache the Seat Map

## Status

Accepted — 2026-07-28.

## Context

The original plan called for Redis caching on both read-heavy endpoints — `GET /events` and `GET /events/:id/seats` — with invalidation on every lock, release, and confirm.

Reviewing that against the rest of the design showed the seat-map half to be self-defeating.

## Decision

- **`GET /events`** — cached in Redis with a plain TTL. No write-driven invalidation, because events are provisioned by seed script and do not change at runtime in this build.
- **`GET /events/:id/seats`** — **not cached.** Served directly from PostgreSQL, with live updates pushed over WebSocket.

## Consequences

**Positive**

- No cache invalidation logic on the hot write path. Checkout, release, and confirm write to PostgreSQL and emit a WebSocket event — they never need to reason about cache coherence.
- No stale-availability class of bug. A cached seat map that survives a lock by even a second shows a seat as free that isn't, and users start hitting "seat unavailable" on seats the UI told them were open.
- Redis remains a genuine optimisation rather than a correctness dependency. Losing Redis degrades event-list latency and nothing else — which is why it is first on the cut list if time runs short.
- Roughly 2 hours saved against the original estimate, redirected to the concurrency work that actually carries the project.

**Negative**

- Seat-map reads always hit the database. Acceptable: they are indexed single-table lookups by `event_id`, and the WebSocket push model means clients fetch the full map once and then receive deltas rather than polling.
- Event list can serve data up to one TTL stale. Harmless here — the data is static after seed.

## Alternatives rejected

**Cache the seat map with write-driven invalidation (the original plan).**
Rejected on the arithmetic. Cache value comes from a high read-to-write ratio. The seat map is the single most-written piece of state in the system — every lock, expiry, release, and confirmation changes it — and each of those writes would trigger an invalidation. Near-every read follows a write, so the hit rate approaches zero while the invalidation logic sits directly on the checkout path, where a bug is a correctness bug rather than a performance one. Maximum complexity, minimum benefit.

It is also redundant with a feature already in scope: real-time seat updates over WebSocket. Building a cache for data that is simultaneously being pushed live to clients means maintaining two freshness mechanisms for one fact.

**Short-TTL cache on the seat map (e.g. 1–2 seconds).**
Rejected: it avoids invalidation logic but guarantees a window in which the map is knowably wrong. For availability data driving a purchase decision, trading correctness for latency is the wrong direction, and the latency being optimised is not a problem in the first place.

**Cut caching entirely.**
Considered seriously. Rejected because the event list is a genuine, honest fit — static data, repeated reads, plain TTL, no invalidation — and demonstrates that caching was applied where the access pattern justifies it. Cutting everything would have removed a real (if small) piece of the system; keeping only the justified half is the more defensible position than either extreme.

## Notes for future readers

The reasoning generalises: **cache where reads dominate writes and staleness is tolerable.** The seat map fails both tests, and the fact that it is the most "obviously" performance-sensitive endpoint is exactly what makes it the trap. Choosing not to cache something is a design decision worth recording, precisely because its absence otherwise looks like an oversight.
