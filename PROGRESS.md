# PROGRESS.md — HisaabSync Build State

> **Read this file FIRST, before touching any code, in every session.**
> **Update this file LAST, before ending every session/task.**
> Keep it compact — status + facts only, no prose logs, no history of what
> was tried and abandoned. If it grows past ~150 lines, prune finished
> phases down to one line each (see Section 5).

Last updated: `2026-08-11` by `Antigravity (Room CRUD Endpoints)`

---

## 1. Phase Status

Mirrors `docs/10-implementation-roadmap.md`. Mark each box `[ ]` `[~]` `[x]`.

- [x] **Phase 1** — Project Foundation & Database Setup
- [x] **Phase 2** — Authentication & Profile Module
- [~] **Phase 3** — Room Lifecycle & RBAC Module
- [ ] **Phase 4** — Treasury Pool & Contribution Workflow
- [ ] **Phase 5** — Expense Tracking & Categories
- [ ] **Phase 6** — Reimbursement Payout Engine
- [ ] **Phase 7** — In-App Notifications & Audit Trail
- [ ] **Phase 8** — Production Hardening, Testing & Documentation

`[~]` = in progress / partially done — always add a one-liner under
"Current Focus" explaining exactly what's missing.

---

## 2. Current Focus

**Active phase:** Phase 3
**Doing right now:** Room CRUD endpoints and `GET /rooms/:roomId/members` are live with RBAC guards. Next: implement remaining membership endpoints (POST /rooms/join, change role, kick, leave requests).
**Blocked by:** none

---

## 3. What's Actually Implemented (source of truth, not intentions)

Only list what is DONE and working. Delete/move to Phase Status once a
whole phase is finished — don't duplicate.

| Module | Endpoints/features live | Notes |
|---|---|---|
| Phase 1 | Base setup, DB Schema, Seed Data, Swagger, ESLint, Global Filters/Pipes | Complete. Ready for Phase 2. |
| Phase 2 | Authentication & Profile Module | Phase 2 done — full JWT lifecycle, `@nestjs/throttler` rate limiting, profile management, e2e and unit tests. See `src/modules/auth/`. |
| Phase 3 (partial) | Room CRUD, event infra, shared enums, RBAC Guards | Room creation (`POST`), listing (`GET /rooms`), fetching details (`GET /rooms/:roomId`), updating (`PATCH`), and listing members (`GET /rooms/:roomId/members`). RBAC Pipeline: `RoomMemberGuard` + `RolesGuard` + `@Roles()` + `@CurrentRoom()`. Event infrastructure: `src/events/event-names.ts`, `src/events/payloads/`. TreasuryAccount + category seeding deferred to Phase 4/5. `pendingExpensesCount` and `pendingContributionsCount` are stubbed as 0. |

---

## 4. Key Decisions & Deviations from `docs/`

Only log something here if it **differs from or adds to** what's written in
`docs/`, or resolves an ambiguity the docs left open. If you followed the
docs exactly, don't log it — that's the default, not news.

- Split Room module into two controller/service/repository pairs: `Room*` (CRUD/settings) and `Member*` (memberships/join-requests). Docs don't prescribe this split, but it follows SRP and avoids a god-service.
- `EventEmitterModule.forRoot()` placed inside RoomModule (first module to emit events). NestJS makes this global, so future modules can just inject `EventEmitter2` without re-importing.
- `room.created` event emitted even though no listeners exist yet — intentionally decoupled; Treasury and Category modules will subscribe later.

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