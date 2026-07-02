# Roadmap

Each phase is built so the next one does **not** require a rewrite. The non-negotiable
consequence: multi-tenancy and a clean activity graph exist from **Phase 1**, even though
only one organization (Innovation Academy) is live at first.

---

## Phase 1 — Foundation & Personal Learning (CURRENT)

Goal: a single learner, inside a single organization, can capture and track their whole
learning life.

- Browser extension: detect learning activity on YouTube, Coursera, Udemy, edX, LinkedIn
  Learning; authenticate to Pleyad; sync activity.
- Personal Learning Library: the learner's unified list of external courses/activities.
- Playlists: goal-oriented grouping of activities.
- Dashboard: progress tracking across everything.
- Auth: email/password + session, **already organization-aware** (membership model).

Exit criteria: Innovation Academy runs entirely on Pleyad as tenant #1, with the
extension syncing real activity into a per-organization, per-user library.

## Phase 2 — Multi-Tenant SaaS

Goal: any organization can self-serve a branded workspace.

- Organization signup & provisioning.
- Workspaces & branding (logo, colors, subdomain/slug resolution).
- Roles & permissions (owner / admin / mentor / member).
- Admin dashboard (members, invites, activity overview).

> The schema already carries `organizationId` + a `memberships` table, so this phase is
> mostly product/UI + provisioning — **not** a data migration.

## Phase 3 — Mentor Marketplace

- Mentor profiles & dashboard.
- Shared progress (mentor ↔ learner visibility, permissioned).
- Tasks & assignments.
- Scheduling.

## Phase 4 — AI Learning Companion

- Smart recommendations (built on the unified activity graph).
- Flashcards, quiz generation, note summarization.
- Learning analytics (learner-, mentor-, and org-level).

---

## Guardrails carried across all phases

1. Every tenant-scoped table carries `organizationId`; data access is scoped by it. No
   query trusts client-supplied tenant identity.
2. The extension is tenant-agnostic — no hardcoded brand/domain.
3. Users are **global identities**; membership links a user to an organization + role. A
   person can belong to several organizations.
4. The learning activity model is generic (platform-agnostic), not shaped around any one
   provider's data.
