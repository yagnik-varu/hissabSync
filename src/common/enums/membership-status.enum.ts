/**
 * Lifecycle status of a RoomMember.
 *
 * Transitions: PENDING_APPROVAL → ACTIVE → LEAVE_REQUESTED → LEFT
 * Only ACTIVE members can execute room transactions (BR-001).
 *
 * @see docs/02-domain-model.md §2 (BR-001) and §3 (RoomMember entity)
 */
export enum MembershipStatus {
  ACTIVE = 'ACTIVE',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  LEAVE_REQUESTED = 'LEAVE_REQUESTED',
  LEFT = 'LEFT',
}
