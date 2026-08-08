# HisaabSync - Implementation Roadmap v1

This roadmap outlines the phased development plan for HisaabSync, organized into testable milestones with clear dependencies and deliverables.

---

## 🏗️ Phase 1: Project Foundation & Database Setup
*Prerequisites: None*

- [ ] Initialize NestJS project with TypeScript strict mode enabled.
- [ ] Configure PostgreSQL database with Docker Compose (`docker-compose.yml`).
- [ ] Initialize Prisma ORM, configure `schema.prisma`, and execute initial migration.
- [ ] Implement Database Seed script (`prisma/seed.ts`) with demo users, rooms, categories, and transactions.
- [ ] Configure global Swagger OpenAPI documentation at `/api/docs`.
- [ ] Setup ESLint, Prettier, and environment configuration (`@nestjs/config`).
- [ ] Setup Global Exception Filter (`AllExceptionsFilter`) and Validation Pipe.

**Deliverable**: Running NestJS server connected to PostgreSQL with Swagger and automated DB seeding.

---

## 🔐 Phase 2: Authentication & Profile Module
*Prerequisites: Phase 1*

- [ ] Implement User Registration (`POST /auth/register`) with bcrypt hashing.
- [ ] Implement User Login (`POST /auth/login`) returning JWT Access + Refresh Tokens.
- [ ] Implement Token Refresh with rotation (`POST /auth/refresh`).
- [ ] Implement Logout (`POST /auth/logout`) with token revocation.
- [ ] Implement Profile & Password endpoints (`GET /auth/me`, `PATCH /auth/profile`, `PATCH /auth/change-password`).
- [ ] Unit & integration tests for Auth flows.

**Deliverable**: Complete JWT authentication lifecycle with token rotation.

---

## 🏠 Phase 3: Room Lifecycle & RBAC Module
*Prerequisites: Phase 2*

- [ ] Implement Room Creation (`POST /rooms`) with auto-assignment of creator as `ADMIN`.
- [ ] Implement Room Settings & Details (`GET /rooms/:roomId`, `PATCH /rooms/:roomId`).
- [ ] Implement Room Join Request flow (`POST /rooms/join`, `GET /rooms/:roomId/join-requests`).
- [ ] Implement Join Approval/Rejection (`PATCH /rooms/:roomId/join-requests/:id/approve|reject`).
- [ ] Implement Role Management & Removal (`PATCH .../role`, `DELETE .../members/:userId`).
- [ ] Implement Room Leave workflow with last-admin safeguard.
- [ ] Implement RBAC Guards (`RoomMemberGuard`, `RolesGuard`, `@Roles()` decorator).

**Deliverable**: Multi-tenant room isolation with active member RBAC validation.

---

## 💰 Phase 4: Treasury Pool & Contribution Workflow
*Prerequisites: Phase 3*

- [ ] Initialize 1:1 `TreasuryAccount` automatically upon room creation.
- [ ] Implement Contribution Submission (`POST /rooms/:roomId/contributions`).
- [ ] Implement Contribution Self-Cancellation (`DELETE /rooms/:roomId/contributions/:id`).
- [ ] Implement Contribution Approval & Rejection inside ACID transaction (`prisma.$transaction`).
- [ ] Implement Immutable Treasury Ledger (`GET /rooms/:roomId/treasury/transactions`).
- [ ] Implement Manual Treasury Adjustments (`POST /rooms/:roomId/treasury/adjustments`).

**Deliverable**: Double-entry style treasury ledger and contribution approval engine.

---

## 🛒 Phase 5: Expense Tracking & Categories
*Prerequisites: Phase 4*

- [ ] Implement Category Management (`GET`, `POST`, `DELETE /rooms/:roomId/categories`).
- [ ] Implement Out-of-pocket Expense Submission (`POST /rooms/:roomId/expenses`).
- [ ] Implement Expense Self-Cancellation (`DELETE /rooms/:roomId/expenses/:id`).
- [ ] Implement Expense Approval & Rejection (`PATCH .../approve|reject`).
- [ ] Publish domain events via NestJS `EventEmitter2` (`expense.submitted`, `expense.approved`).

**Deliverable**: Full expense lifecycle with event-driven triggers.

---

## 💳 Phase 6: Reimbursement Payout Engine
*Prerequisites: Phase 5*

- [ ] Implement Event Listener: Auto-create `Reimbursement` on `expense.approved`.
- [ ] Implement List & Get Reimbursements (`GET /rooms/:roomId/reimbursements`).
- [ ] Implement Reimbursement Payout (`PATCH /rooms/:roomId/reimbursements/:id/pay`):
  - Validate Strict Treasury balance policy.
  - Record `DEBIT` entry in `treasury_transactions`.
  - Atomically update materialized balance in `treasury_accounts`.
- [ ] Concurrency testing to prevent race conditions on balance deduction.

**Deliverable**: Automated reimbursement creation and treasury payout workflow.

---

## 🔔 Phase 7: In-App Notifications & Audit Trail
*Prerequisites: Phase 6*

- [ ] Implement In-App Notifications Service & API (`GET /notifications`, `PATCH .../read`).
- [ ] Implement Event Listeners for domain events to create user notifications.
- [ ] Implement Room Activity Feed (`GET /rooms/:roomId/activity`).
- [ ] Implement System Audit Logging for administrative/financial events.

**Deliverable**: Real-time user alert center and transparent activity timeline.

---

## 🚀 Phase 8: Production Hardening, Testing & Documentation
*Prerequisites: Phase 7*

- [ ] Add Rate Limiting with `@nestjs/throttler` on sensitive routes.
- [ ] Implement Health Checks (`/health`) with `@nestjs/terminus`.
- [ ] Comprehensive End-to-End (E2E) Test Suite with Supertest.
- [ ] Complete Swagger/OpenAPI documentation with request/response samples.
- [ ] Dockerize application (`Dockerfile`, `docker-compose.prod.yml`).
- [ ] Write deployment guide and root `README.md`.

**Deliverable**: Production-ready, enterprise-grade HisaabSync backend repository.