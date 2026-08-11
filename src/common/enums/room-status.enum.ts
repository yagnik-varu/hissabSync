/**
 * Lifecycle status of a Room.
 *
 * - ACTIVE:   Room is operational; members can transact.
 * - ARCHIVED: Room is frozen; read-only access for historical data.
 *
 * @see docs/02-domain-model.md §3 (Room entity)
 */
export enum RoomStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}
