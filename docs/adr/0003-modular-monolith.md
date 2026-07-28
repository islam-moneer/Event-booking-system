# ADR 0003: Modular Monolith, Not Microservices

## Status

Accepted — 2026-07-28.

## Context

Ticket booking is a common microservices case study — an events service, a booking service, a payments service, a notifications service. It is worth stating explicitly why this project does not do that, because the choice looks like the "less advanced" one and will be questioned.

## Decision

Build a **modular monolith**: one deployable Node.js application, one PostgreSQL database, with internal module boundaries enforced by a layered structure (Controller → Service → Repository) and directory separation by domain.

## Consequences

**Positive**

- **The core guarantee stays enforceable.** Multi-seat atomic locking is a single ACID transaction across seat rows. In a monolith that is one `BEGIN`/`COMMIT`. Split across services with separate databases, it becomes a distributed transaction — sagas, compensating actions, eventual consistency — and "no double-booking" becomes something you approximate rather than guarantee.
- Local development and test setup are trivial, which matters directly: a reviewer must be able to clone and run the concurrency proof without orchestrating containers.
- Module boundaries still exist and are visible in the structure, so the code demonstrates separation of concerns without paying distributed-systems costs.

**Negative**

- No independent scaling per domain. Irrelevant at this scale, and horizontal scaling of the whole app still works because all state is in PostgreSQL (see [ADR 0001](0001-seat-locking-strategy.md) — no in-process locks).
- No independent deployment per module. Irrelevant for a solo developer.
- Module boundaries are conventional, not enforced by the network. Discipline is required to avoid a service reaching directly into another domain's repository.

## Alternatives rejected

**Microservices split by domain.**
Rejected because it would actively damage the thing the project is built to demonstrate. Splitting bookings from seat inventory turns a single-transaction correctness guarantee into a distributed coordination problem requiring sagas or a two-phase commit — strictly more complexity, strictly weaker guarantees, for a system with one developer and no scaling pressure.

The industry position here is not controversial: microservices trade consistency and operational simplicity for independent scaling and team autonomy. This project has one team member and no scaling requirement, so it would be paying the entire cost of that trade to buy nothing. Martin Fowler's "MonolithFirst" argument applies directly.

**Serverless functions.**
Rejected: cold starts and per-invocation connection handling make long-lived PostgreSQL connection pooling awkward, and the WebSocket requirement for live seat updates fits poorly with a stateless function model.

**Layered monolith with no module boundaries.**
Rejected as the opposite failure — it would satisfy NFR4 in letter (controllers, services, repositories) while producing a codebase where every domain reaches into every other. The modular structure is what makes a later extraction possible if it were ever warranted.

## Notes for future readers

The interview-relevant framing: choosing a monolith here is not the absence of an architectural decision, it is the decision that preserves the transactional guarantee the whole system is built around. Microservices would have been the easier thing to *claim* and the harder thing to make *correct*.
