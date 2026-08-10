# PROGRESS.md — HisaabSync Build State

> **Read this file FIRST, before touching any code, in every session.**
> **Update this file LAST, before ending every session/task.**
> Keep it compact — status + facts only, no prose logs, no history of what
> was tried and abandoned. If it grows past ~150 lines, prune finished
> phases down to one line each (see Section 5).

Last updated: `2026-08-10` by `Antigravity (ESLint & Config Loaders)`

---

## 1. Phase Status

Mirrors `docs/10-implementation-roadmap.md`. Mark each box `[ ]` `[~]` `[x]`.

- [~] **Phase 1** — Project Foundation & Database Setup
- [ ] **Phase 2** — Authentication & Profile Module
- [ ] **Phase 3** — Room Lifecycle & RBAC Module
- [ ] **Phase 4** — Treasury Pool & Contribution Workflow
- [ ] **Phase 5** — Expense Tracking & Categories
- [ ] **Phase 6** — Reimbursement Payout Engine
- [ ] **Phase 7** — In-App Notifications & Audit Trail
- [ ] **Phase 8** — Production Hardening, Testing & Documentation

`[~]` = in progress / partially done — always add a one-liner under
"Current Focus" explaining exactly what's missing.

---

## 2. Current Focus

**Active phase:** Phase 1
**Doing right now:** ESLint/Prettier setup and `@nestjs/config` environments confirmed. Next: Global Exception Filter and Validation Pipe.
**Blocked by:** none

---

## 3. What's Actually Implemented (source of truth, not intentions)

Only list what is DONE and working. Delete/move to Phase Status once a
whole phase is finished — don't duplicate.

| Module | Endpoints/features live | Notes |
|---|---|---|
| Core / Config | Base app bootstrap, `@nestjs/config` loaders (`src/config/*`), global Swagger OpenAPI at `/api/docs` | Strict TS, strict ESLint (no explicit any), `api/v1` prefix, CORS configured |
| Database | Prisma schema validated, migration applied (`20260810062013_init`), 14 tables + indexes created in Postgres, Database Seeded (`npx prisma db seed`) | Base tables and dummy data ready for downstream modules |

---

## 4. Key Decisions & Deviations from `docs/`

Only log something here if it **differs from or adds to** what's written in
`docs/`, or resolves an ambiguity the docs left open. If you followed the
docs exactly, don't log it — that's the default, not news.

*(none)*

---

## 5. Known Issues / TODO Debt

*(none)*

---

## 6. Environment / Setup Facts

Things a fresh session needs to not re-discover by trial and error.

- DB: PostgreSQL 15+ configured via `docker/docker-compose.dev.yml`
- DB Start Command: `docker compose -f docker/docker-compose.dev.yml up -d`
- DB Stop Command: `docker compose -f docker/docker-compose.dev.yml down`
- `.env`: Created from `.env.example`
- Seed data: Seeded via `prisma/seed.ts` (3 Users, 1 Room, Categories, Initial Treasury Balance, etc.)
- Last known good command to run the app: `npm run build` / `npm run start:dev`
- Last known good command to run tests: `npm test`

---

## 7. Pruning Rule (keep this file small)

When a phase is fully `[x]` complete:
1. Collapse its "What's Actually Implemented" rows into a single summary
   line under that phase in Section 1 (e.g. "Phase 2 done — full JWT
   lifecycle, see `src/modules/auth/`").
2. Remove resolved items from Section 5.
3. Never delete Section 4 entries — decisions/deviations stay for the life
   of the project, they're cheap (one line each) and expensive to
   rediscover.