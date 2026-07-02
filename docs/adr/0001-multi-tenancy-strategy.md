# ADR 0001 — Multi-tenancy strategy

- **Status:** Accepted
- **Date:** 2026-07-02
- **Decision owner:** Architecture

## Context

Pleyad is a multi-tenant SaaS from day one, even though only one organization (Innovation
Academy) is live in Phase 1. We must choose how tenants are isolated in the database. The
choice is expensive to reverse, so we make it now rather than retrofitting after Phase 1
features exist.

Options:

1. **Shared database, shared schema** — one set of tables, an `organizationId` column on
   every tenant-scoped table.
2. **Shared database, schema-per-tenant** — one database, a separate SQL schema per tenant.
3. **Database-per-tenant** — a physical database per tenant.

## Decision

**Adopt option 1: shared database, shared schema, with an `organizationId` discriminator
on every tenant-scoped table**, and enforce isolation in a data-access layer that requires
`organizationId` on every tenant-scoped query.

Identity model:

- `users` — **global** identities (unique email across the whole platform).
- `organizations` — tenants / workspaces (each has a unique `slug` for branding & routing).
- `memberships` — `(userId, organizationId, role, status)`; unique on `(userId, organizationId)`.
- All learning data (`external_courses`, `playlists`, `playlist_items`, …) carries
  `organizationId` **and** `userId`.

## Rationale

- **Right cost curve for early SaaS.** Option 1 is the standard for a young multi-tenant
  product: one migration path, one connection pool, trivial to onboard tenant N+1 (insert
  a row), and cheap to operate. Options 2 and 3 multiply operational cost (migrations,
  backups, connections) per tenant before we have the tenants to justify it.
- **Phase 2 becomes product work, not a migration.** Because `organizationId` and
  `memberships` exist now, "add organizations + branding + admin" ships without touching
  the shape of existing data.
- **Global users enable the real model.** A learner may belong to Innovation Academy *and*
  a company workspace; mentors (Phase 3) span organizations. Global identity + membership
  supports this natively.
- **TiDB scales horizontally.** Our MySQL-compatible store (TiDB) scales out, so the shared
  table approach doesn't hit a single-node ceiling early.

## Consequences

- **Isolation is enforced by code, not by the database.** This is the main risk of option
  1. We mitigate it structurally: the *only* place tenant-scoped queries are written is a
  repository layer that takes `organizationId` as a required parameter; the server resolves
  `organizationId` from the session, never from client input. Cross-tenant reads/writes
  require deliberately bypassing this layer.
- Every tenant-scoped table needs an index leading with `organizationId`.
- "Noisy neighbor" performance isolation is not free; acceptable at current scale.

## Upgrade path (documented, not built)

If a future enterprise contract demands hard physical isolation, we can promote a single
tenant to its own database by routing that tenant's connection differently — the
`organizationId`-scoped repository layer is the seam that makes this possible without
rewriting business logic.
