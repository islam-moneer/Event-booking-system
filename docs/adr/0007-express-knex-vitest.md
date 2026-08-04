# ADR 0007: Express, Knex, and Vitest

## Status

Accepted — 2026-07-29.

Supplies the choices left open as _TBD_ in the initial README tech-stack table.

## Context

Three tooling decisions were deferred until scaffolding, because none of them affect the locking design that the rest of the ADRs settle: the HTTP framework, the database access layer, and the test runner.

They are recorded here rather than left implicit because one of them — the database layer — is load-bearing for [ADR 0001](0001-seat-locking-strategy.md). The locking strategy depends on issuing `SELECT ... FOR UPDATE` over an explicit, ordered set of rows inside a transaction. A data layer that obscures that is disqualifying, however pleasant its ergonomics.

## Decision

**Express 5** as the HTTP framework, **Knex** as the query builder and migration tool, **Vitest** as the test runner, all on **TypeScript** with native ESM and Node 22+.

## Consequences

**Positive**

- **Knex keeps SQL visible.** `trx('seats').whereIn('id', ids).orderBy('id').forUpdate()` reads as the SQL it generates. The lock ordering that prevents deadlock between overlapping seat sets is written explicitly and is reviewable as such. Knex also owns migrations, so schema and query layer are one dependency rather than two.
- **Express 5 handles async errors natively.** A rejected promise from an `async` handler now propagates to the error middleware without a `wrapAsync` helper. In Express 4 that omission produced a hung request; removing the trap is worth adopting the newer major.
- **Vitest runs TypeScript ESM without a transform step.** The project is `"type": "module"` with `.js`-suffixed relative imports; Vitest reads `tsconfig.json` directly. Jest would need `ts-jest` or Babel plus ESM configuration that is still experimental.
- **Vitest's `globalSetup` runs migrations once** before the suite, so a clean clone needs no manual migrate step before `npm test`.

**Negative**

- **Knex gives no compile-time schema types.** A renamed column surfaces as a runtime failure, not a type error. Mitigated by hand-written row interfaces in `src/models/` and by every repository method being covered by an integration test against a real PostgreSQL instance.
- **Express 5 is comparatively new**, and some middleware ecosystems still target 4.x. Nothing this project depends on is affected.
- **Vitest is less ubiquitous than Jest** in existing Node codebases. The API is Jest-compatible in the parts that matter.

## Alternatives rejected

**Prisma** (instead of Knex).
The strongest alternative, and rejected on the project's central requirement rather than on preference. Prisma's generated client gives excellent type safety and a clean migration story, but it has no first-class `SELECT ... FOR UPDATE`. Row-level pessimistic locking requires dropping to `$queryRaw`, which means the single most important query in the system would bypass the abstraction that justified the dependency — while still paying its cost everywhere else. A tool whose escape hatch is needed for the core operation is the wrong tool for this core.

**TypeORM** (instead of Knex).
Supports pessimistic locks via `setLock('pessimistic_write')`, so it clears the correctness bar. Rejected for weight: decorators, entity metadata, and a change-tracking layer are a large surface to introduce for a schema of six tables, and its migration generation has a reputation for surprising output. The repository pattern here is already explicit ([ADR 0003](0003-modular-monolith.md)); an ORM's main offering is a pattern the project implements deliberately by hand.

**Raw `pg` with hand-written SQL** (instead of Knex).
Maximum control and zero abstraction, which is genuinely tempting for a project about SQL semantics. Rejected because it means hand-rolling a migration runner, and Knex's tracked, reversible migrations are worth more than the thin query-building layer costs. Knex does not hide `pg` — the pool and the driver are the same underneath, and raw SQL is one `knex.raw()` away where it reads better.

**Fastify** (instead of Express 5).
Faster, with schema-based validation built in. Rejected because throughput is not this project's bottleneck — row contention on `seats` is — and Express is the framework a reviewer can read without consulting documentation. Fastify's validation advantage is modest here given the small number of endpoints.

**NestJS** (instead of Express 5).
Rejected as scope inversion. Nest imposes a module/provider/DI architecture on a codebase whose architecture is already decided and small enough to state in one line: Controller → Service → Repository. The framework would dominate a project whose subject is a concurrency problem.

**Jest** (instead of Vitest).
Rejected on ESM friction alone, as above. No feature of Jest is needed that Vitest lacks.

## Notes for future readers

The framing that matters: the data layer was chosen by the same method as the database in [ADR 0005](0005-postgresql-over-nosql.md) — working backwards from the hardest requirement. Prisma is the better tool for most Node projects and would likely be the right default on a team; it is the wrong one here because "ordered pessimistic row locks over an explicit set of rows" is the operation the whole system is built around, and that operation must be first-class rather than an escape hatch.

The framework and runner choices carry no such weight and are reversible in an afternoon.
