# AGENTS.md — HisaabSync Build Guide

All authoritative specs live in `docs/`. **Do not guess or invent behavior**
that is already defined in these files — go read the relevant one first, then
implement. Treat `docs/` as the single source of truth over your own prior
assumptions or general framework knowledge.

---

## 0. How to use this file

1. Identify what part of the system the current task touches (auth, rooms,
   treasury, expenses, reimbursements, notifications, audit, API shape,
   database, RBAC, error handling, repo layout, coding rules, or roadmap
   phase).
2. Open the matching doc(s) from the table below **before** writing code.
3. Implement strictly according to that doc. If two docs disagree, prefer
   (in this order): `02-domain-model.md` → `05-database-design.md` →
   `06-api-design.md` → the others.
4. Follow the "Learning Mode" instructions in Section 3 for *every* task,
   not just complex ones.

---

## 1. Session Start / End Protocol (do this every time, no exceptions)

`docs/` describes the *plan*. `PROGRESS.md` describes *reality* — what's
actually built right now. Quota resets and new sessions mean you often
start with zero memory of prior work, so this file is what prevents
re-exploring the whole codebase (or re-implementing something) just to
figure out where things stand.

- **At the start of every session/task**: read `PROGRESS.md` before reading
  anything else, before exploring `src/`, and before touching `docs/`.
  It tells you the current phase, what's actually implemented (not just
  planned), and any open blockers — that's usually enough to jump straight
  to the right doc section and the right file.
- **At the end of every session/task**: update `PROGRESS.md` — phase
  checkboxes, "Current Focus", and anything new in "Implemented" or "Known
  Issues". Keep it short (see the pruning rule inside that file). This is
  not optional busywork — skipping it is what causes the next session to
  waste quota re-discovering state.
- If `PROGRESS.md` and the actual code disagree (e.g. it says a module is
  done but tests fail or code is missing), trust the code, fix
  `PROGRESS.md`, and say so explicitly in your explanation.

---

## 2. Docs Index — go here for specific information

> Note: this table is for the *plan* (`docs/`). For *current build state*
> (what's already done), that's `PROGRESS.md`, not this table — see
> Section 1.

| Need info about... | Read this file |
|---|---|
| What the product does, personas, V1 vs V2 scope, functional/non-functional requirements | `docs/01-product-requirements.md` |
| Entities, fields, business rules (BR-001...BR-009), module boundaries | `docs/02-domain-model.md` |
| Commands, domain events, event payload envelope, side-effect policies | `docs/03-event-storming.md` |
| Overall architecture, module layering, folder pattern per module, transaction code patterns, security middleware, dependency graph | `docs/04-system-architecture.md` |
| Table schemas, column types/constraints, ER diagram, indexes | `docs/05-database-design.md` |
| Every REST endpoint, request/response JSON shapes, response wrapper formats | `docs/06-api-design.md` |
| Roles (ADMIN/ACCOUNTANT/MEMBER), permission matrix, guard pipeline, NestJS decorator examples | `docs/07-rbac-design.md` |
| End-to-end request flows (sequence diagrams) for expense approval, contribution approval, reimbursement payout, join flow, auth/refresh | `docs/08-sequence-diagrams.md` |
| Error response format, full error code catalog, global exception filter implementation | `docs/09-error-handling-strategy.md` |
| Full repo folder tree, standard module internal structure, architectural boundary rules | `docs/11-repository-structure.md` |
| Phased build order, what to build in what sequence, per-phase deliverables | `docs/10-implementation-roadmap.md` |
| Naming conventions, money/Decimal rules, transaction rules, TS strictness, logging rules, PR Definition of Done | `docs/12-coding-standards.md` |

> Keep these 12 files inside a `docs/` folder at the project root exactly as
> named above — this table assumes those exact filenames.

---

## 3. Non-negotiable rules (apply to every task, no exceptions)

Pulled forward from the docs because agents tend to forget these mid-task:

- **Money**: never use JS `number` math for currency. Always `Prisma.Decimal`
  / `Decimal.js`. DB columns are `DECIMAL(12,2)`. (`12-coding-standards.md`)
- **Transactions**: any operation touching more than one table or the ledger
  must be wrapped in `prisma.$transaction`. (`04-system-architecture.md`,
  `12-coding-standards.md`)
- **Zero hard deletes**: financial records, memberships, expenses,
  contributions are never hard-deleted — only status-transitioned.
  (`01-product-requirements.md`, `02-domain-model.md`)
- **Modular monolith boundaries**: no direct cross-module DB queries or
  Prisma calls from services outside their own module. Cross-module
  communication = exported service interfaces or `EventEmitter2` domain
  events only. (`04-system-architecture.md`, `11-repository-structure.md`)
- **Layering inside a module**: Controller (routing only) → Service
  (business logic + events) → Repository (all Prisma access). Services never
  import `PrismaClient` directly. (`04-system-architecture.md`)
- **RBAC guard order**: `JwtAuthGuard` → `RoomMemberGuard` → `RolesGuard`,
  always in that sequence. (`07-rbac-design.md`)
- **Errors**: throw semantic exceptions with the exact error codes from
  `09-error-handling-strategy.md` (e.g. `TREASURY_INSUFFICIENT_BALANCE`),
  never generic `Error` or ad-hoc strings.
- **Follow the roadmap order**: don't build Phase 5 (Expenses) before Phase 4
  (Treasury) is working, etc. Check `10-implementation-roadmap.md` for
  prerequisites before starting a phase.

---

## 4. Learning Mode — required for every task

The person driving this build is using it as a **learning project**, not just
shipping code. For every task the agent performs, it must:

1. **Before coding**: briefly state which doc(s) it consulted and the 1-3
   key rules/decisions pulled from them that shape the implementation.
2. **While coding**: explain *why*, not just *what* — e.g. why a row lock is
   needed here, why this goes in a service vs a repository, why an event is
   emitted instead of a direct function call, why Decimal instead of number.
   Keep explanations short and plain — a few sentences per non-obvious
   decision, not a lecture.
3. **After coding**: give a short summary of what was built, how it maps
   back to the spec (FR/BR/endpoint IDs where relevant), and one pointer to
   what to learn/read next if the person wants to go deeper (e.g. "this is a
   good spot to read up on Prisma's `SELECT ... FOR UPDATE` behavior").
4. If the person's instruction conflicts with something in `docs/`, flag the
   conflict explicitly instead of silently picking one — this is itself a
   learning moment worth surfacing.
5. Prefer clarity over cleverness in code — this codebase is also a teaching
   artifact. Favor readable, well-named, slightly more verbose code over
   dense one-liners.

---

## 5. Suggested workflow per task

1. Read `PROGRESS.md` (Section 1 above) — don't skip this even for a
   "quick" task.
2. Read the roadmap phase this task belongs to (`10-implementation-roadmap.md`).
3. Pull the relevant entity/rules (`02-domain-model.md`), endpoint contract
   (`06-api-design.md`), schema (`05-database-design.md`), and RBAC rule
   (`07-rbac-design.md`) for the feature.
4. Check `08-sequence-diagrams.md` if the feature involves a multi-step flow
   or event side-effects.
5. Implement following `04-system-architecture.md` layering and
   `11-repository-structure.md` file layout.
6. Apply `12-coding-standards.md` conventions and `09-error-handling-strategy.md`
   error codes.
7. Explain as you go, per Section 4.
8. Update `PROGRESS.md` before finishing (Section 1 above).

---

## 6. Project layout Antigravity should expect/create

```
HisaabSync/
├── AGENTS.md          # this file — read automatically, keep at root
├── PROGRESS.md         # current build state — read first, update last, every session
├── docs/              # 12 spec files — do not edit, read-only reference
│   ├── 01-product-requirements.md
│   ├── 02-domain-model.md
│   ├── 03-event-storming.md
│   ├── 04-system-architecture.md
│   ├── 05-database-design.md
│   ├── 06-api-design.md
│   ├── 07-rbac-design.md
│   ├── 08-sequence-diagrams.md
│   ├── 09-error-handling-strategy.md
│   ├── 10-implementation-roadmap.md
│   ├── 11-repository-structure.md
│   └── 12-coding-standards.md
├── .agents/
│   └── skills/        # optional: reusable slash-command skills, e.g.
│                       #   .agents/skills/new-module.md → scaffolds a
│                       #   module following docs/11-repository-structure.md
├── prisma/
├── src/
└── test/
```

Optional next step once the base build is stable: add task-specific skills
under `.agents/skills/` (e.g. `add-endpoint.md`, `add-migration.md`,
`review-against-standards.md`) so recurring workflows become `/slash`
commands instead of re-explaining them each time. Not required to start —
`AGENTS.md` + `docs/` + `PROGRESS.md` is enough to begin building.