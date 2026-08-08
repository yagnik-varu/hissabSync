# HisaabSync - Product Requirements Document (PRD)

## 1. Product Overview & Vision

**HisaabSync** is a collaborative Room Treasury and Pool Expense Management System designed for shared living arrangements (hostel rooms, shared apartments/flats, trip groups, and student cohorts).

Unlike traditional peer-to-peer debt simplification tools (such as Splitwise), **HisaabSync operates on a shared treasury pool model**:
1. Members pool funds into a shared room treasury (`Contributions`).
2. When a member pays for a shared room expense out-of-pocket (`Expenses`), upon approval by an Admin or Accountant, the system automatically creates a debt owed by the room treasury to that member (`Reimbursements`).
3. When the treasury reimburses the member (`Reimbursement Payout`), the shared treasury balance is debited and recorded in an immutable ledger.

This ensures 100% financial transparency, eliminates messy cross-member peer debts, and provides real-time visibility into the room's shared cash flow.

---

## 2. Target User Personas

| Persona | Role | Key Objectives & Pain Points |
|---|---|---|
| **Room Admin** | Flat Lead / Room Owner | Creates the room, invites members, manages room settings (strict vs flexible treasury), assigns roles, reviews join/leave requests, and monitors overall treasury health. |
| **Room Accountant** | Treasurer / Finance Manager | Reviews submitted expenses, approves/rejects contributions, processes reimbursement payouts, and reconciles the treasury ledger. |
| **Room Member** | Roommate / Flatmate | Submits contributions, submits out-of-pocket expenses with receipt proofs, tracks reimbursement status, and monitors treasury balance. |

---

## 3. Scope Boundaries (V1 vs Future Roadmap)

| Capability | V1 In-Scope (Modular Monolith) | V2 Future Scope (Microservices / Extensions) |
|---|---|---|
| **Authentication** | Email/Password, JWT (Access + Refresh Rotation), Profile Management | OAuth (Google/Apple), Magic Links, 2FA |
| **Room Management** | Room creation, Unique Room Codes, Join/Leave approval workflows, Archiving | Multi-room grouping, QR code invites |
| **Treasury & Ledger** | Single room treasury pool, Double-entry style credit/debit ledger, Strict/Flexible balance policy | Sub-wallets per category, multi-currency conversion |
| **Contributions** | Manual contribution submission + Admin/Accountant approval + Ledger credit | Direct payment gateway integration (UPI / Razorpay / Stripe) |
| **Expenses** | Out-of-pocket expense submission with categories and receipt image URL + Approval | OCR auto-scanning of receipts, AI WhatsApp message parsing |
| **Reimbursements** | Automatic creation upon expense approval + Manual payout recording + Ledger debit | Instant automated UPI payout via Cashfree/RazorpayX |
| **Notifications** | In-app notifications with read/unread tracking | Push notifications (FCM), WhatsApp alerts, Email digests |
| **Audit & Activity** | Room activity timeline and internal audit logs with JSON metadata | PDF monthly statement generator, advanced export (CSV/Excel) |

---

## 4. Functional Requirements (FR)

### FR-01: User Management & Authentication
- **FR-01.1**: Users must be able to register with `fullName`, unique `email`, `phone`, and `password`.
- **FR-01.2**: Passwords must be securely hashed using `bcrypt` (or `argon2`) with salt rounds ≥ 10.
- **FR-01.3**: Authentication must use short-lived JWT Access Tokens (e.g. 15 minutes) and long-lived rotating Refresh Tokens (e.g. 7 days).
- **FR-01.4**: Users must be able to view and update their profile details (`fullName`, `phone`, `profileImageUrl`) and change passwords.

### FR-02: Room Lifecycle & Membership
- **FR-02.1**: Any authenticated user can create a room, becoming the room's initial `ADMIN`.
- **FR-02.2**: Each room is assigned a unique, human-friendly 6-to-8 character alphanumeric `roomCode`.
- **FR-02.3**: Users join a room by entering the `roomCode`, which creates a `JoinRequest` in `PENDING` state.
- **FR-02.4**: Room `ADMIN` can approve or reject join requests. Rejections can include an optional `rejectionReason`.
- **FR-02.5**: Members can request to leave a room (`LEAVE_REQUESTED`), requiring Admin approval. Historical financial records are permanently preserved (no hard deletes).
- **FR-02.6**: A room must always retain at least one active `ADMIN`. The last Admin cannot leave or demote themselves without transferring ownership.
- **FR-02.7**: Rooms cannot be permanently deleted; they can be archived (`ARCHIVED`), freezing all transactions while preserving the audit trail.

### FR-03: Room Treasury Pool & Ledger
- **FR-03.1**: Every room automatically has exactly one associated `TreasuryAccount`.
- **FR-03.2**: The treasury balance can be configured per room:
  - **Strict Treasury Mode**: Reimbursement payouts cannot cause the treasury balance to drop below ₹0.00.
  - **Flexible Treasury Mode**: Treasury balance is allowed to go negative if members are temporarily fronting money.
- **FR-03.3**: All money movements are immutably recorded in `treasury_transactions` as either `CREDIT` (incoming funds) or `DEBIT` (outgoing funds).
- **FR-03.4**: The ledger is the single source of truth. The stored `current_balance` is a high-performance materialized snapshot updated inside database transactions.

### FR-04: Contribution Lifecycle
- **FR-04.1**: Any active room member can submit a contribution record indicating money deposited into the shared pool.
- **FR-04.2**: Contributions remain in `PENDING` status until reviewed by an `ADMIN` or `ACCOUNTANT`.
- **FR-04.3**: The submitting member can cancel their contribution while it is still `PENDING`.
- **FR-04.4**: Approving a contribution updates its status to `APPROVED` and atomically records a `CREDIT` transaction in the treasury ledger, increasing the treasury balance.
- **FR-04.5**: Rejecting a contribution updates its status to `REJECTED` with an optional reason, with no ledger impact.

### FR-05: Expense & Category Tracking
- **FR-05.1**: Members can create and manage custom room expense categories (e.g. Rent, Groceries, Electricity, Wi-Fi, Water, Maid).
- **FR-05.2**: Any active member can submit an expense incurred on behalf of the room, providing `amount`, `title`, `categoryId`, `description`, and an optional `receiptUrl`.
- **FR-05.3**: The submitting member can cancel or edit their expense while it remains `PENDING`.
- **FR-05.4**: `ADMIN` or `ACCOUNTANT` can approve or reject the expense.

### FR-06: Automated Reimbursements
- **FR-06.1**: When an expense is approved, the system automatically creates a `Reimbursement` record for the submitting member with status `PENDING_PAYMENT` and amount equal to the approved expense.
- **FR-06.2**: An `ADMIN` or `ACCOUNTANT` records when the reimbursement is physically paid out to the member (`Mark Paid`).
- **FR-06.3**: Marking a reimbursement as `PAID` atomically records a `DEBIT` entry in the treasury ledger and decreases the treasury balance.
- **FR-06.4**: In Strict Treasury mode, if the treasury balance is insufficient to cover the reimbursement, the payment action is rejected with `TREASURY_INSUFFICIENT_BALANCE`.

### FR-07: In-App Notifications
- **FR-07.1**: The system must generate real-time in-app notifications for key domain events (join request submitted/approved/rejected, expense submitted/approved/rejected, contribution approved/rejected, reimbursement paid).
- **FR-07.2**: Users can list their notifications, filter by unread status, mark individual notifications as read, or mark all as read.

### FR-08: Activity Feed & Audit Trail
- **FR-08.1**: All members can view the room activity feed chronologically.
- **FR-08.2**: System generates structured `audit_logs` capturing `actorId`, `action`, `entityType`, `entityId`, and JSON `metadata` for compliance and troubleshooting.

---

## 5. Non-Functional Requirements (NFR)

- **NFR-01: Financial Accuracy & Precision**: All financial amounts must be represented using 2-decimal precision (`DECIMAL(12, 2)` / `Decimal.js`). Floating-point arithmetic is strictly prohibited.
- **NFR-02: ACID Data Consistency & Concurrency**: All ledger mutations (contribution approval, reimbursement payout, balance update) must execute inside database transactions with row-level locking (`SELECT ... FOR UPDATE`) to prevent race conditions or double-spending.
- **NFR-03: Performance & SLA**: API response time for p95 requests must be under 200ms under standard load.
- **NFR-04: Security & Access Control**: 
  - Strict Room-Based Role Access Control (RBAC).
  - Passwords hashed with bcrypt (salt cost ≥ 10).
  - Rate limiting on authentication and sensitive endpoints.
  - JWT tokens signed with secure algorithms (RS256 or HS256 with strong secrets).
- **NFR-05: Auditability & Zero Hard Deletion**: Financial transactions, expenses, contributions, and memberships must never be hard-deleted from the database. State transitions and soft deactivations are mandatory.
- **NFR-06: Extensibility**: The codebase must follow a clean Modular Monolith design with domain event decoupling (`EventEmitter2`) to enable future extraction into microservices (e.g. Notification Service, Treasury Service).