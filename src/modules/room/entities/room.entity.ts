/**
 * Room domain entity interface.
 *
 * Maps to the `rooms` database table. Used as a typed return shape
 * from the repository layer so services don't depend on raw Prisma types.
 *
 * @see docs/02-domain-model.md §3 (Room entity)
 * @see docs/05-database-design.md (rooms table)
 */
export interface RoomEntity {
  id: string;
  name: string;
  roomCode: string;
  description: string | null;
  status: string; // RoomStatus enum value
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
