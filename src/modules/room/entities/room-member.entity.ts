/**
 * RoomMember domain entity interface.
 *
 * Maps to the `room_members` database table.
 *
 * @see docs/02-domain-model.md §3 (RoomMember entity)
 * @see docs/05-database-design.md (room_members table)
 */
export interface RoomMemberEntity {
  id: string;
  roomId: string;
  userId: string;
  role: string; // Role enum value
  status: string; // MembershipStatus enum value
  joinedAt: Date;
  leftAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
