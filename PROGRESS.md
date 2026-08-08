# PROGRESS.md — HisaabSync Build State

> **Read this file FIRST, before touching any code, in every session.**
> **Update this file LAST, before ending every session/task.**
> Keep it compact — status + facts only, no prose logs, no history of what
> was tried and abandoned. If it grows past ~150 lines, prune finished
> phases down to one line each (see Section 5).

Last updated: `<YYYY-MM-DD>` by `<agent/session note, optional>`

---

## 1. Phase Status

Mirrors `docs/10-implementation-roadmap.md`. Mark each box `[ ]` `[~]` `[x]`.

- [ ] **Phase 1** — Project Foundation & Database Setup
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

**Active phase:** _(e.g. Phase 4)_
**Doing right now:** _(e.g. "Implementing PATCH /reimbursements/:id/pay — strict mode balance check done, DEBIT ledger write not yet wired")_
**Blocked by:** _(none / describe)_

---

## 3. What's Actually Implemented (source of truth, not intentions)

Only list what is DONE and working. Delete/move to Phase Status once a
whole phase is finished — don't duplicate.

| Module | Endpoints/features live | Notes |
|---|---|---|
| _e.g. auth_ | _register, login, refresh_ | _logout not done_ |

---

## 4. Key Decisions & Deviations from `docs/`

Only log something here if it **differs from or adds to** what's written in
`docs/`, or resolves an ambiguity the docs left open. If you followed the
docs exactly, don't log it — that's the default, not news.

- _e.g._: "Used `crypto.randomUUID()` for roomCode base + custom 6-char
  alphanumeric slicer instead of a package, per no-new-deps preference."

---

## 5. Known Issues / TODO Debt

- _e.g._: "Concurrency test for reimbursement payout (Phase 6 roadmap item)
  not written yet."

---

## 6. Environment / Setup Facts

Things a fresh session needs to not re-discover by trial and error.

- DB: _(e.g. running via docker-compose, migrated up to `<migration name>`)_
- `.env`: _(e.g. copied from `.env.example`, no secrets changed)_
- Seed data: _(e.g. seeded / not seeded)_
- Last known good command to run the app: `<command>`
- Last known good command to run tests: `<command>`

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