# HisaabSync - Event Storming & Domain Events v1

## 1. Event Storming Overview

This document maps all user **Commands**, resulting **Domain Events**, automatic **Policies (Side-Effects)**, and generated notifications across the HisaabSync system.

### Standard Event Envelope Schema
All domain events published via NestJS `EventEmitter2` adhere to a unified payload envelope:

```json
{
  "eventId": "123e4567-e89b-12d3-a456-426614174000",
  "eventName": "expense.approved",
  "aggregateId": "expense-uuid",
  "roomId": "room-uuid",
  "actorId": "admin-uuid",
  "occurredAt": "2026-08-08T12:00:00.000Z",
  "payload": {
    "expenseId": "expense-uuid",
    "roomId": "room-uuid",
    "submittedBy": "member-uuid",
    "amount": "1200.00",
    "title": "Groceries"
  },
  "metadata": {
    "correlationId": "req-12345",
    "sourceModule": "expense"
  }
}
```

---

## 2. Room Lifecycle Events

### Create Room
- **Command**: `CreateRoom`
- **Actor**: Authenticated User
- **Domain Event**: `room.created`
- **Owner**: `RoomModule`
- **Side Effects / Policies**:
  - Assign creator as `ADMIN` in `RoomMember`.
  - Create default `RoomSettings`.
  - Initialize 1:1 `TreasuryAccount` with balance ₹0.00 (`treasury.account.created`).
  - Seed default `ExpenseCategory` records (Rent, Groceries, Electricity, Maintenance).

### Update Room Settings
- **Command**: `UpdateRoomSettings`
- **Actor**: Room Admin
- **Domain Event**: `room.settings.updated`
- **Owner**: `RoomModule`
- **Side Effects**: Generate audit log entry.

### Archive Room
- **Command**: `ArchiveRoom`
- **Actor**: Room Admin
- **Domain Event**: `room.archived`
- **Owner**: `RoomModule`
- **Side Effects**: Freeze all new transactions, notify all members.

---

## 3. Room Join & Membership Events

### Request Room Join
- **Command**: `RequestRoomJoin`
- **Actor**: Authenticated User (with `roomCode`)
- **Domain Event**: `room.join.requested`
- **Owner**: `RoomModule`
- **Side Effects**: Create `JoinRequest(PENDING)`, send in-app notification to all room Admins.

### Approve Join Request
- **Command**: `ApproveJoinRequest`
- **Actor**: Room Admin
- **Domain Event**: `room.join.approved`
- **Owner**: `RoomModule`
- **Side Effects**:
  - Update `JoinRequest` to `APPROVED`.
  - Create `RoomMember(role=MEMBER, status=ACTIVE)`.
  - Emit `room.member.added`.
  - Send notification to the user.

### Reject Join Request
- **Command**: `RejectJoinRequest`
- **Actor**: Room Admin
- **Domain Event**: `room.join.rejected`
- **Owner**: `RoomModule`
- **Side Effects**: Update `JoinRequest` to `REJECTED` with `rejectionReason`, notify user.

### Change Member Role / Transfer Ownership
- **Command**: `ChangeMemberRole` / `TransferRoomOwnership`
- **Actor**: Room Admin
- **Domain Event**: `room.member.role_changed` / `room.ownership.transferred`
- **Owner**: `RoomModule`
- **Side Effects**: Update role, verify at least one active Admin remains, record audit log, notify affected member.

### Request Leave Room
- **Command**: `RequestRoomLeave`
- **Actor**: Active Member
- **Domain Event**: `room.leave.requested`
- **Owner**: `RoomModule`
- **Side Effects**: Update member status to `LEAVE_REQUESTED`, notify Admins.

### Approve Leave Request
- **Command**: `ApproveLeaveRequest`
- **Actor**: Room Admin
- **Domain Event**: `room.member.deactivated`
- **Owner**: `RoomModule`
- **Side Effects**: Update member status to `LEFT` with `leftAt` timestamp. Historical records remain untouched.

### Reject Leave Request
- **Command**: `RejectLeaveRequest`
- **Actor**: Room Admin
- **Domain Event**: `room.leave.rejected`
- **Owner**: `RoomModule`
- **Side Effects**: Revert member status to `ACTIVE`, notify member with reason.

---

## 4. Contribution Events

### Submit Contribution
- **Command**: `SubmitContribution`
- **Actor**: Active Room Member
- **Domain Event**: `contribution.submitted`
- **Owner**: `TreasuryModule`
- **Side Effects**: Create `Contribution(PENDING)`, notify Admins and Accountants.

### Cancel Contribution (Self-Service)
- **Command**: `CancelContribution`
- **Actor**: Submitting Member
- **Domain Event**: `contribution.cancelled`
- **Owner**: `TreasuryModule`
- **Precondition**: Contribution status is `PENDING`.
- **Side Effects**: Update status to `CANCELLED`, remove pending review alert.

### Approve Contribution
- **Command**: `ApproveContribution`
- **Actor**: Room Admin / Accountant
- **Domain Event**: `contribution.approved`
- **Owner**: `TreasuryModule`
- **Side Effects / Policies**:
  - Update `Contribution` status to `APPROVED`.
  - Atomic DB Transaction: Create `TreasuryTransaction(CREDIT, CONTRIBUTION)` and increase `TreasuryAccount.currentBalance`.
  - Emit `treasury.balance.increased`.
  - Record `AuditLog(CONTRIBUTION_APPROVED)`.
  - Send notification to contributor.

### Reject Contribution
- **Command**: `RejectContribution`
- **Actor**: Room Admin / Accountant
- **Domain Event**: `contribution.rejected`
- **Owner**: `TreasuryModule`
- **Side Effects**: Update status to `REJECTED` with `rejectionReason`, notify contributor.

---

## 5. Expense Events

### Submit Expense
- **Command**: `SubmitExpense`
- **Actor**: Active Room Member
- **Domain Event**: `expense.submitted`
- **Owner**: `ExpenseModule`
- **Side Effects**: Create `Expense(PENDING)`, notify Admins and Accountants.

### Cancel Expense (Self-Service)
- **Command**: `CancelExpense`
- **Actor**: Submitting Member
- **Domain Event**: `expense.cancelled`
- **Owner**: `ExpenseModule`
- **Precondition**: Expense status is `PENDING`.
- **Side Effects**: Update status to `CANCELLED`.

### Approve Expense
- **Command**: `ApproveExpense`
- **Actor**: Room Admin / Accountant
- **Domain Event**: `expense.approved`
- **Owner**: `ExpenseModule`
- **Side Effects / Policies**:
  - Update `Expense` status to `APPROVED`.
  - Automatic Policy: Create `Reimbursement(PENDING_PAYMENT, amount=expense.amount)`.
  - Emit `reimbursement.created`.
  - Record `AuditLog(EXPENSE_APPROVED)`.
  - Send notification to submitting member.

### Reject Expense
- **Command**: `RejectExpense`
- **Actor**: Room Admin / Accountant
- **Domain Event**: `expense.rejected`
- **Owner**: `ExpenseModule`
- **Side Effects**: Update `Expense` status to `REJECTED` with `rejectionReason`, record audit log, notify member.

---

## 6. Reimbursement Events

### Auto-Create Reimbursement
- **Trigger**: Domain event `expense.approved`
- **Policy**: Auto-generate debt record
- **Domain Event**: `reimbursement.created`
- **Owner**: `ReimbursementModule`
- **Status**: `PENDING_PAYMENT`

### Pay Reimbursement (Payout Execution)
- **Command**: `PayReimbursement`
- **Actor**: Room Admin / Accountant
- **Domain Event**: `reimbursement.paid`
- **Owner**: `ReimbursementModule`
- **Precondition Checks**:
  - If Strict Treasury Mode is enabled: Verify `treasuryBalance >= reimbursementAmount`. If insufficient, block execution with `TREASURY_INSUFFICIENT_BALANCE`.
- **Side Effects / Policies**:
  - Update `Reimbursement` status to `PAID`, record `paidBy` and `paidAt`.
  - Atomic DB Transaction: Create `TreasuryTransaction(DEBIT, REIMBURSEMENT)` and decrease `TreasuryAccount.currentBalance`.
  - Emit `treasury.balance.decreased`.
  - Record `AuditLog(REIMBURSEMENT_PAID)`.
  - Send notification to beneficiary member.

---

## 7. Manual Treasury Adjustments

### Record Treasury Adjustment
- **Command**: `CreateTreasuryAdjustment`
- **Actor**: Room Admin
- **Domain Event**: `treasury.adjustment.created`
- **Owner**: `TreasuryModule`
- **Side Effects**:
  - Atomic DB Transaction: Create `TreasuryTransaction(CREDIT|DEBIT, ADJUSTMENT)` with explicit audit explanation.
  - Update `TreasuryAccount.currentBalance`.
  - Record `AuditLog(TREASURY_ADJUSTMENT)`.

---

## 8. Summary of Integration Events for Future Microservices (RabbitMQ)

When extracting microservices in V2, these in-process events map directly to RabbitMQ message exchange routing keys:

| Event Name | Routing Key | Target Microservice Handlers |
|---|---|---|
| `room.created` | `room.created` | Notification Service, Analytics |
| `room.member.added` | `room.member.added` | Notification Service, Auth Cache |
| `contribution.approved` | `contribution.approved` | Notification Service, Reporting Service |
| `expense.approved` | `expense.approved` | Reimbursement Service, Notification Service |
| `reimbursement.paid` | `reimbursement.paid` | Notification Service, Treasury Service |
| `treasury.balance.decreased`| `treasury.balance.updated` | WhatsApp Summary Bot, Alert Service |
