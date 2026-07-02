# Pleyad

**The operating system for learning.**

Pleyad doesn't host courses. It connects everything a learner studies across the
internet — YouTube, Coursera, Udemy, edX, LinkedIn Learning, and more — into one
unified, organized, trackable learning experience.

A **browser extension** is the entry point: it detects learning activity wherever it
happens and syncs it into the learner's personal space inside Pleyad.

Pleyad is a **multi-tenant SaaS platform**. Universities, companies, ministries,
academies, and organizations create their own branded workspaces. **Innovation Academy**
is the first organization on the platform — the flagship workspace, "Powered by Pleyad."

---

## Monorepo structure

```
pleyad/
├── apps/
│   ├── platform/      # Main app: learner web app + API (React + Vite + Express + tRPC)
│   └── extension/     # Browser extension — the entry point (detect & sync learning activity)
├── packages/
│   ├── db/            # Drizzle ORM schema + migrations (the single source of truth for data)
│   └── shared/        # Shared TypeScript types, constants, tRPC contracts
├── docs/
│   ├── vision.md            # What we're building and why
│   ├── architecture.md      # System architecture & principles
│   ├── roadmap.md           # Phased roadmap (Phase 1–4)
│   ├── database.md          # Data model reference
│   └── adr/                 # Architecture Decision Records
└── (root configs: pnpm workspace, turbo, tsconfig, gitignore)
```

> `apps/platform` intentionally keeps web + API together for Phase 1 (fast iteration,
> one deploy). It is structured so the API can be split into its own service later
> without touching the data layer or the extension. See `docs/adr/0002-tech-stack.md`.

## Tech stack (summary)

TypeScript everywhere · React 19 + Vite · Express + tRPC · Drizzle ORM ·
MySQL-compatible (TiDB Cloud) · pnpm workspaces + Turborepo.

See `docs/adr/0002-tech-stack.md` for the reasoning.

## Status

Phase 1 in progress. See `docs/roadmap.md`.

## Getting started

_Scaffolding in progress. Setup instructions will land once `apps/platform` is bootstrapped._
