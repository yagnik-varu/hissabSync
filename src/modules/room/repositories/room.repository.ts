import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Role as PrismaRole, MemberStatus } from '../../../../generated/prisma/client/client';

/**
 * Database access layer for Room, RoomSettings, and RoomMember tables.
 *
 * Why does createRoomWithSettingsAndMember use prisma.$transaction?
 * Creating a room involves 3 table writes (Room, RoomSettings, RoomMember)
 * that must all succeed or all fail. Without a transaction, a crash after
 * creating the Room but before creating RoomSettings would leave an
 * orphaned room with no settings — violating the 1:1 invariant from
 * docs/02-domain-model.md. The $transaction gives us atomicity: if any
 * step fails, everything rolls back.
 *
 * @see docs/04-system-architecture.md (transaction code patterns)
 * @see docs/12-coding-standards.md (multi-table = $transaction)
 */
@Injectable()
export class RoomRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomically creates a Room, its default RoomSettings, and the creator's
   * RoomMember (role=ADMIN, status=ACTIVE) in a single transaction.
   *
   * Returns the created room with its settings included.
   */
  async createRoomWithSettingsAndMember(data: {
    name: string;
    roomCode: string;
    description?: string;
    createdBy: string;
    currencyCode: string;
    allowNegativeTreasury: boolean;
  }) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Create the Room row
      const room = await tx.room.create({
        data: {
          name: data.name,
          roomCode: data.roomCode,
          description: data.description,
          createdBy: data.createdBy,
        },
      });

      // 2. Create the 1:1 RoomSettings with caller-provided or DB-default values
      const settings = await tx.roomSettings.create({
        data: {
          roomId: room.id,
          currencyCode: data.currencyCode,
          allowNegativeTreasury: data.allowNegativeTreasury,
          // requireExpenseApproval, requireContributionApproval,
          // autoCreateReimbursement all use DB defaults (true)
        },
      });

      // 3. Add the creator as the first ADMIN member with ACTIVE status
      const member = await tx.roomMember.create({
        data: {
          roomId: room.id,
          userId: data.createdBy,
          role: PrismaRole.ADMIN,
          status: MemberStatus.ACTIVE,
        },
      });

      return { room, settings, member };
    });
  }

  /**
   * Check if a room code already exists — used during unique code generation
   * to avoid collisions.
   */
  async existsByRoomCode(roomCode: string): Promise<boolean> {
    const count = await this.prisma.room.count({
      where: { roomCode },
    });
    return count > 0;
  }
}
