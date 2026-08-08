# HisaabSync - Domain Model & Business Rules v1

## 1. Product Vision & Domain Model Overview

**HisaabSync** is a Room Treasury and Expense Management System for shared living groups. 

The domain model revolves around a **shared room treasury (pool fund)**:
- A **Room** is an independent accounting unit containing members and exactly one treasury account.
- The **Treasury Account** maintains a double-entry ledger of all money movements.
- **Contributions** add capital into the treasury pool.
- **Expenses** represent shared purchases paid out-of-pocket by members.
- **Reimbursements** represent treasury debt owed back to the member who incurred an approved expense.
- **Ledger Transactions** (`CREDIT` and `DEBIT`) provide an immutable audit trail of all cash flows.

```
                      +-------------------+
                      |       Room        |
                      +---------+---------+
                                | 1:1
                                v
                      +-------------------+
                      |  TreasuryAccount  |
                      +---------+---------+
                                | 1:N
                                v
                      +-------------------+
                      |TreasuryTransaction|
                      +-------------------+
                                ^
            +-------------------+-------------------+
            | (CREDIT)                              | (DEBIT)
   +--------+--------+                     +--------+--------+
   |  Contribution   |                     |  Reimbursement  |
   +-----------------+                     +--------+--------+
                                                    | 1:1
                                           +--------+--------+
                                           |     Expense     |
                                           +-----------------+
```

---

## 2. Core Business Rules

### BR-001: Room Membership & Multi-Tenancy
- A user can belong to multiple rooms simultaneously (e.g., Hostel Flat, Office Room, Friend Trip).
- Each room membership is evaluated in isolation with its own specific role (`ADMIN`, `ACCOUNTANT`, `MEMBER`).
- Membership status transitions: `PENDING_APPROVAL` → `ACTIVE` → `LEAVE_REQUESTED` → `LEFT`. Only `ACTIVE` members can execute room transactions.

### BR-002: Treasury Funding & Ledger Immutability
- The treasury pool balance increases only when a `Contribution` is reviewed and marked `APPROVED` by an Admin or Accountant.
- Approving a contribution atomically writes an immutable `CREDIT` transaction to `treasury_transactions`.
- Stored balance is a high-performance materialized snapshot updated inside an ACID transaction alongside ledger insertion.

### BR-003: Expense Approval Authority
- Only users with `ADMIN` or `ACCOUNTANT` roles in the room can approve or reject expenses.
- Regular `MEMBER` users cannot approve their own or others' expenses.
- When an expense is rejected, an optional `rejectionReason` must be recorded, and no reimbursement is created.

### BR-004: Automatic Reimbursement Creation
- When an expense is approved, the system **automatically generates a corresponding Reimbursement record** for the beneficiary (`submittedBy` user).
- Initial reimbursement status is `PENDING_PAYMENT` with `amount = expense.amount`.
- No separate reimbursement request is required from the member.

### BR-005: Treasury Balance Policy (Strict vs. Flexible)
Room treasury behavior is configurable via `RoomSettings`:
- **Mode A: Strict Treasury (`allowNegativeTreasury = false`)**:
  - The treasury balance cannot drop below ₹0.00.
  - If `treasuryBalance < reimbursementAmount`, the payment is blocked with `TREASURY_INSUFFICIENT_BALANCE`.
- **Mode B: Flexible Treasury (`allowNegativeTreasury = true`)**:
  - Treasury balance is permitted to go negative (e.g. balance ₹300 - payout ₹500 = balance -₹200).
  - Used when members front money before collective pool funding is collected.

### BR-006: Member Exit & Historical Data Preservation
- Members cannot delete their account or leave instantly if they have active financial associations.
- The member submits a leave request (`LEAVE_REQUESTED`) for Admin review.
- Upon approval, the membership status changes to `LEFT`.
- **Zero Hard Deletion**: All historical expenses, contributions, audit logs, and ledger entries remain intact permanently.

### BR-007: Last Admin Safeguard & Ownership Transfer
- Every room must have **at least one active ADMIN** at all times.
- The last Admin cannot leave the room or demote their role to `MEMBER`/`ACCOUNTANT` without first transferring ownership to another active member.

### BR-008: Self-Cancellation of Pending Submissions
- A member who submitted an expense or contribution can cancel/withdraw their submission as long as its status is still `PENDING`.
- Once `APPROVED` or `REJECTED` by an Admin/Accountant, the submission is immutable and cannot be cancelled or deleted.

### BR-009: Financial Precision & Currency Standard
- All financial calculations must strictly use 2-decimal precision (`DECIMAL(12, 2)` in database and `Decimal.js` in application logic).
- Standard floating-point math (`number`) is forbidden for financial balances and transaction totals.

---

## 3. Domain Entities

### User
Represents a global authenticated identity across the system.
- `id` (UUID): Primary key.
- `fullName` (String): User's display name.
- `email` (String): Unique email for login.
- `phone` (String, optional): Contact number.
- `passwordHash` (String): Bcrypt hashed password.
- `profileImageUrl` (String, optional): Avatar image URL.
- `isActive` (Boolean): Account active status.
- `createdAt`, `updatedAt` (DateTime).

### RefreshToken
Manages JWT refresh sessions.
- `id` (UUID): Primary key.
- `userId` (UUID): Foreign key → User.
- `tokenHash` (String): Hashed refresh token.
- `expiresAt` (DateTime): Token expiry timestamp.
- `createdAt` (DateTime).

### Room
Represents an isolated treasury and expense management group.
- `id` (UUID): Primary key.
- `name` (String): Room display name (e.g., "Flat 402", "Manali Trip 2026").
- `roomCode` (String): Unique 6-to-8 character alphanumeric code for joining.
- `description` (String, optional): Room details/rules.
- `status` (Enum: `ACTIVE`, `ARCHIVED`): Room lifecycle state.
- `createdBy` (UUID): Foreign key → User (Creator).
- `createdAt`, `updatedAt` (DateTime).

### RoomSettings
Configures behavior and financial constraints for a specific room.
- `id` (UUID): Primary key.
- `roomId` (UUID): Unique foreign key → Room (1:1).
- `currencyCode` (String): Default `"INR"`.
- `allowNegativeTreasury` (Boolean): Strict vs Flexible balance mode.
- `requireExpenseApproval` (Boolean): Default `true`.
- `requireContributionApproval` (Boolean): Default `true`.
- `autoCreateReimbursement` (Boolean): Default `true`.
- `createdAt`, `updatedAt` (DateTime).

### RoomMember
Represents user membership and role within a room.
- `id` (UUID): Primary key.
- `roomId` (UUID): Foreign key → Room.
- `userId` (UUID): Foreign key → User.
- `role` (Enum: `ADMIN`, `ACCOUNTANT`, `MEMBER`).
- `status` (Enum: `ACTIVE`, `PENDING_APPROVAL`, `LEAVE_REQUESTED`, `LEFT`).
- `joinedAt` (DateTime).
- `leftAt` (DateTime, optional).
- `createdAt`, `updatedAt` (DateTime).
- *Constraint*: Unique `(roomId, userId)`.

### JoinRequest
Tracks membership join requests submitted via room codes.
- `id` (UUID): Primary key.
- `roomId` (UUID): Foreign key → Room.
- `userId` (UUID): Foreign key → User.
- `status` (Enum: `PENDING`, `APPROVED`, `REJECTED`).
- `rejectionReason` (String, optional).
- `reviewedBy` (UUID, optional): Foreign key → User.
- `reviewedAt` (DateTime, optional).
- `createdAt` (DateTime).

### TreasuryAccount
Represents the financial treasury pool of a room.
- `id` (UUID): Primary key.
- `roomId` (UUID): Unique foreign key → Room (1:1).
- `currentBalance` (Decimal 12,2): High-performance materialized balance snapshot.
- `createdAt`, `updatedAt` (DateTime).

### TreasuryTransaction
The immutable double-entry ledger recording all cash flows.
- `id` (UUID): Primary key.
- `roomId` (UUID): Foreign key → Room.
- `transactionType` (Enum: `CREDIT`, `DEBIT`).
- `referenceType` (Enum: `CONTRIBUTION`, `REIMBURSEMENT`, `ADJUSTMENT`).
- `referenceId` (UUID, optional): Foreign key to the originating entity.
- `amount` (Decimal 12,2): Positive transaction amount.
- `description` (String): Purpose of the transaction.
- `createdBy` (UUID): Foreign key → User (Actor who approved/initiated).
- `createdAt` (DateTime).

### Contribution
Represents money added into the treasury pool by a member.
- `id` (UUID): Primary key.
- `roomId` (UUID): Foreign key → Room.
- `contributorId` (UUID): Foreign key → User.
- `amount` (Decimal 12,2): Amount contributed.
- `note` (String, optional): Description of contribution.
- `status` (Enum: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`).
- `rejectionReason` (String, optional).
- `approvedBy` (UUID, optional): Foreign key → User.
- `approvedAt` (DateTime, optional).
- `createdAt`, `updatedAt` (DateTime).

### ExpenseCategory
Categorizes room expenses for reporting.
- `id` (UUID): Primary key.
- `roomId` (UUID): Foreign key → Room.
- `name` (String): Category name (e.g., "Groceries", "Utilities", "Maintenance").
- `isDefault` (Boolean): Default `false`.
- `createdAt` (DateTime).

### Expense
Represents a shared expense incurred out-of-pocket by a room member.
- `id` (UUID): Primary key.
- `roomId` (UUID): Foreign key → Room.
- `submittedBy` (UUID): Foreign key → User.
- `categoryId` (UUID): Foreign key → ExpenseCategory.
- `amount` (Decimal 12,2): Expense amount.
- `title` (String): Short summary.
- `description` (String, optional): Detailed notes.
- `receiptUrl` (String, optional): Proof of purchase image/invoice URL.
- `status` (Enum: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`).
- `rejectionReason` (String, optional).
- `reviewedBy` (UUID, optional): Foreign key → User.
- `reviewedAt` (DateTime, optional).
- `createdAt`, `updatedAt` (DateTime).

### Reimbursement
Represents debt owed by the room treasury to a member who incurred an approved expense.
- `id` (UUID): Primary key.
- `expenseId` (UUID): Unique foreign key → Expense (1:1).
- `roomId` (UUID): Foreign key → Room.
- `beneficiaryId` (UUID): Foreign key → User.
- `amount` (Decimal 12,2): Amount to be reimbursed.
- `status` (Enum: `PENDING_PAYMENT`, `PAID`, `REJECTED`).
- `paidBy` (UUID, optional): Foreign key → User (Accountant/Admin who executed payout).
- `paidAt` (DateTime, optional).
- `createdAt`, `updatedAt` (DateTime).

### Notification
In-app user alerts for domain events.
- `id` (UUID): Primary key.
- `userId` (UUID): Foreign key → User.
- `roomId` (UUID, optional): Foreign key → Room.
- `title` (String): Short title.
- `message` (String): Notification text.
- `isRead` (Boolean): Default `false`.
- `createdAt` (DateTime).

### AuditLog
System audit record for compliance, security, and administrative history.
- `id` (UUID): Primary key.
- `roomId` (UUID, optional): Foreign key → Room.
- `actorId` (UUID): Foreign key → User.
- `entityType` (String): E.g., `EXPENSE`, `CONTRIBUTION`, `ROOM_MEMBER`, `TREASURY`.
- `entityId` (UUID): Identifier of the affected entity.
- `action` (String): E.g., `EXPENSE_APPROVED`, `REIMBURSEMENT_PAID`, `ROLE_UPDATED`.
- `metadata` (JSONB): Context snapshot (old status, new status, amounts, IP).
- `createdAt` (DateTime).

---

## 4. Architectural Boundaries

- **Modular Monolith**: Core business modules (`Auth`, `Room`, `Treasury`, `Expense`, `Reimbursement`, `Notification`, `Audit`) are cleanly separated.
- **Cross-Module Communication**:
  - Synchronous queries use exported Module Service interfaces.
  - Asynchronous business side-effects use domain events emitted via NestJS `EventEmitter2`.
  - Modules never directly query or mutate database tables belonging to other modules.
