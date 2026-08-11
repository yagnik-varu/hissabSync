/**
 * Centralized registry of all domain event names used across the system.
 *
 * Why an enum instead of string literals?
 * - Compile-time typo protection: `EventNames.ROOM_CREATED` vs 'room.cretaed'
 * - Single place to see every event the system can emit
 * - IDE autocomplete when calling eventEmitter.emit()
 *
 * Naming convention: 'module.entity.action' (matches docs/03-event-storming.md)
 */
export enum EventNames {
  // ─── Room Lifecycle ────────────────────────────────────────
  ROOM_CREATED = 'room.created',
  ROOM_SETTINGS_UPDATED = 'room.settings.updated',
  ROOM_ARCHIVED = 'room.archived',

  // ─── Room Membership ───────────────────────────────────────
  ROOM_JOIN_REQUESTED = 'room.join.requested',
  ROOM_JOIN_APPROVED = 'room.join.approved',
  ROOM_JOIN_REJECTED = 'room.join.rejected',
  ROOM_MEMBER_ADDED = 'room.member.added',
  ROOM_MEMBER_ROLE_CHANGED = 'room.member.role_changed',
  ROOM_OWNERSHIP_TRANSFERRED = 'room.ownership.transferred',
  ROOM_LEAVE_REQUESTED = 'room.leave.requested',
  ROOM_MEMBER_DEACTIVATED = 'room.member.deactivated',
  ROOM_LEAVE_REJECTED = 'room.leave.rejected',

  // ─── Contribution ─────────────────────────────────────────
  CONTRIBUTION_SUBMITTED = 'contribution.submitted',
  CONTRIBUTION_CANCELLED = 'contribution.cancelled',
  CONTRIBUTION_APPROVED = 'contribution.approved',
  CONTRIBUTION_REJECTED = 'contribution.rejected',

  // ─── Expense ──────────────────────────────────────────────
  EXPENSE_SUBMITTED = 'expense.submitted',
  EXPENSE_CANCELLED = 'expense.cancelled',
  EXPENSE_APPROVED = 'expense.approved',
  EXPENSE_REJECTED = 'expense.rejected',

  // ─── Reimbursement ────────────────────────────────────────
  REIMBURSEMENT_CREATED = 'reimbursement.created',
  REIMBURSEMENT_PAID = 'reimbursement.paid',

  // ─── Treasury ─────────────────────────────────────────────
  TREASURY_ACCOUNT_CREATED = 'treasury.account.created',
  TREASURY_BALANCE_INCREASED = 'treasury.balance.increased',
  TREASURY_BALANCE_DECREASED = 'treasury.balance.decreased',
  TREASURY_ADJUSTMENT_CREATED = 'treasury.adjustment.created',
}
