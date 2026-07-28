# ADR 0006: MVP Scope Cuts — Organizer Role, Payments, Refunds

## Status

Accepted — 2026-07-28.

## Context

Several features that a real ticketing platform obviously needs are absent. Their absence is deliberate, and this record exists so it reads as judgement rather than as an unfinished project.

The governing constraint: two weeks, one developer, ~6 build hours per day. The project's value comes from proving one hard thing thoroughly, not from covering many easy things shallowly.

## Decision

Cut from the MVP:

- **Organizer role and event-creation API** — events and seat maps are provisioned by a seed script.
- **Real payment gateway** — checkout confirmation calls a mock payment step.
- **Refunds, cancellations, waitlists.**
- **Admin dashboard UI** — API-only, with a Postman/Swagger collection.
- **Multi-tenancy and organizer billing.**

## Consequences

**Positive**

- Roughly 3 hours reclaimed from the organizer CRUD alone, redirected into the concurrency work that carries the project.
- Each cut removes an entire surface area of tests, validation, and authorization rules that would demonstrate nothing not already demonstrated elsewhere. Event creation is ordinary CRUD; the auth system already proves role-free JWT authentication works.
- The seat-locking logic — the actual subject — gets the time it needs. It is the one component whose difficulty is genuinely hard to estimate.

**Negative**

- The system is not a complete product. A reviewer looking for breadth rather than depth will notice.
- Events can only be created by running the seed script, so demoing new data requires a script run rather than an API call.
- Reintroducing the organizer role later means adding a `role` column and authorization middleware — cheap, because nothing was built around its absence.

## Alternatives rejected

**Build a thin version of everything.**
Rejected. This produces a system that does many things unconvincingly, and — critically — the one thing an interviewer can actually probe deeply would be the shallowest part. Under a fixed time budget, depth on the hard problem beats breadth across easy ones.

**Keep the organizer role as an "optional stretch" (the original plan).**
Rejected because "optional stretch" was doing no work. The original documents listed it as optional in one section and as a numbered functional requirement with a success criterion in another. Ambiguous scope is worse than either answer: it means carrying a decision unmade into the build, where it gets made accidentally by whatever there happens to be time for.

**Integrate a real payment provider (Stripe test mode).**
Rejected. It would demonstrate reading a third-party SDK's documentation. The interesting engineering is what happens *around* the payment — the reservation window, the expiry, the confirm-vs-expiry race — and all of that is exercised identically by a mock. A real gateway also introduces webhook handling and network flakiness into the test suite, which would make the concurrency tests harder to keep deterministic.

**Refunds and cancellations.**
Rejected: they are state transitions on an already-solved model (`booked` → `refunded`), interesting operationally but adding nothing to the concurrency story.

## Notes for future readers

The intended reading: this is not a ticketing platform with pieces missing. It is a focused demonstration of concurrent multi-seat reservation correctness, with everything that does not serve that goal explicitly and traceably removed. Every cut above is recoverable and none of them are load-bearing for the parts that exist.
