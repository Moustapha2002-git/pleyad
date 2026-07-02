# Architecture

## Principles

1. **Multi-tenant from line one.** Single database, single schema, `organizationId`
   discriminator on every tenant-scoped row. Tenancy is enforced in a data-access layer,
   never trusted from the client. (See `adr/0001`.)
2. **Users are global; membership grants access.** A `user` is a person. A `membership`
   ties a user to an organization with a role. Access is always resolved through
   membership, never through the user alone.
3. **The activity graph is provider-agnostic.** We model "a learning activity" generically
   (source platform is an attribute), so adding a new platform is data, not a schema change.
4. **The extension is a client, not the app.** It authenticates like any other client and
   speaks the same typed API. No business logic lives only in the extension.
5. **Type safety end to end.** One schema (Drizzle) → shared types → tRPC contract →
   frontend. A change to the data model surfaces as a compile error everywhere it matters.
6. **Split when there's pain, not before.** Phase 1 co-locates web + API in one deployable.
   Boundaries are drawn so extraction (separate API service, separate marketing site) is
   mechanical later.

## High-level shape

```
                 ┌─────────────────────┐
  Browser        │  Extension          │  detects activity on YouTube/Coursera/...
  (learner)      │  (apps/extension)   │  authenticates, syncs → API
                 └──────────┬──────────┘
                            │  typed API (tRPC/HTTP)
                            ▼
 ┌───────────────────────────────────────────────┐
 │  apps/platform                                 │
 │  ┌──────────────┐        ┌──────────────────┐  │
 │  │ web (React)  │◄──tRPC─►│ api (Express)    │  │
 │  │ learner UI   │        │ routers + auth   │  │
 │  └──────────────┘        └────────┬─────────┘  │
 │                                   │            │
 │                    tenant-scoped data access   │
 └───────────────────────────────────┼────────────┘
                                     ▼
                      ┌──────────────────────────┐
                      │ packages/db (Drizzle)    │
                      │ MySQL-compatible (TiDB)  │
                      └──────────────────────────┘
```

## The tenancy boundary (the most important rule)

Every request resolves to a `(user, organization, role)` triple **on the server** from the
session — never from a request body or query param. Every tenant-scoped query is filtered
by that resolved `organizationId`. A thin repository layer in `packages/db` (or the API
data layer) is the *only* place raw queries live, and it takes `organizationId` as a
required argument. This is how we make cross-tenant data leaks structurally hard rather
than relying on discipline in every router.

## Layers

- **`packages/db`** — schema, migrations, and tenant-scoped repository functions. The
  single source of truth for data shape and access.
- **`packages/shared`** — types/constants/contracts shared by web, api, and extension.
- **`apps/platform/api`** — tRPC routers (auth, learning library, playlists, dashboard),
  session/auth, tenancy resolution.
- **`apps/platform/web`** — the learner-facing SPA.
- **`apps/extension`** — detection content scripts + background sync + auth handshake.

## Security posture (Phase 1 baseline, hardened over time)

- Passwords hashed with scrypt (carried over from proven Innovation Academy code).
- Sessions via signed, httpOnly cookies; JWT for extension ↔ API where a cookie isn't
  available.
- Secrets never committed (env-based); a real secrets manager arrives with the second
  environment.
- Tenant isolation enforced in the data layer (above). Authorization checks on every
  mutation via role.

## What we deliberately defer

- Splitting API into its own service (until scale/deploy pain justifies it).
- Schema-per-tenant or db-per-tenant isolation (only if a future enterprise contract
  demands hard isolation — `adr/0001` documents the upgrade path).
- Event streaming / analytics pipeline (Phase 4 concern).
