# ADR 0002 — Tech stack & repository shape

- **Status:** Accepted
- **Date:** 2026-07-02
- **Decision owner:** Architecture

## Context

We are starting Pleyad as a fresh, clean codebase. Innovation Academy already exists as a
working reference implementation built on a proven stack. We must decide (a) the tech stack
and (b) the repository shape, balancing "don't reinvent what works" against "don't inherit
single-tenant assumptions."

## Decision

**Keep the proven stack; restructure into a monorepo; rebuild the core multi-tenant-first.**

Stack:

- **Language:** TypeScript everywhere.
- **Frontend:** React 19 + Vite. Wouter for routing, TailwindCSS + Radix UI for the design
  system.
- **API:** Express + tRPC 11 (end-to-end type safety with the frontend).
- **ORM / DB:** Drizzle ORM against MySQL-compatible **TiDB Cloud**.
- **Auth:** scrypt password hashing + signed httpOnly cookie sessions; JWT for the
  extension handshake.
- **Tooling:** pnpm workspaces + Turborepo; Prettier; Vitest.

Repository shape: **monorepo** with `apps/*` and `packages/*` (see README).

## Rationale

- **Reuse proven choices.** Innovation Academy validated this exact stack in production.
  Re-picking it removes risk and lets us port reference code instead of rediscovering it.
- **tRPC + Drizzle give end-to-end types**, which matters more as surfaces multiply (web,
  extension, future admin). One schema change propagates as compile errors.
- **Monorepo** because Pleyad is inherently multi-surface (web, extension, shared packages,
  future admin/marketing). Shared types and a shared design system must not be copy-pasted
  across repos.
- **TiDB** is MySQL-compatible *and* horizontally scalable — fits the shared-schema
  multi-tenant model in `adr/0001`.

## Explicitly considered and deferred

- **Next.js** instead of Vite SPA: attractive for SEO on public marketing/branded landing
  pages (Phase 2). Deferred — Phase 1 is an authenticated app where Vite is simpler and
  already proven. Revisit when public per-tenant marketing pages become a priority.
- **Separate API service** from day one: deferred (see `architecture.md`) — co-located in
  `apps/platform` until deploy/scale pain justifies the split.
- **A managed auth provider** (Clerk/Auth0/WorkOS): worth revisiting for Phase 2 enterprise
  SSO, but Phase 1 keeps the proven in-house auth to avoid per-MAU cost and vendor lock-in
  before we need org SSO.

## Consequences

- We port selected Innovation Academy code (extension detection logic, scrypt auth, UI
  components) into Pleyad packages, adapting each to be organization-aware and brand-neutral.
- New engineers need familiarity with pnpm workspaces + Turborepo.
