/**
 * Role within a Room. Determines what actions a member can perform.
 *
 * - ADMIN:      Full room management (approve/reject, manage members, settings).
 * - ACCOUNTANT: Financial operations (approve expenses/contributions, payouts).
 * - MEMBER:     Submit expenses/contributions, view data, request to leave.
 *
 * @see docs/02-domain-model.md §3 (RoomMember entity)
 * @see docs/07-rbac-design.md (permission matrix)
 */
export enum Role {
  ADMIN = 'ADMIN',
  ACCOUNTANT = 'ACCOUNTANT',
  MEMBER = 'MEMBER',
}
