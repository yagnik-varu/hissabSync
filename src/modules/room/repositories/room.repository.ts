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

  /**
   * Retrieves a paginated list of rooms the user belongs to.
   */
  async findMyRooms(
    userId: string,
    params: { status?: PrismaRole | any; skip: number; take: number },
  ) {
    const whereCondition: any = {
      members: {
        some: {
          userId,
          status: MemberStatus.ACTIVE, // Only show rooms where user is currently active
        },
      },
    };

    if (params.status) {
      whereCondition.status = params.status;
    }

    const [rooms, total] = await Promise.all([
      this.prisma.room.findMany({
        where: whereCondition,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          settings: true,
          _count: {
            select: { members: { where: { status: MemberStatus.ACTIVE } } },
          },
          members: {
            where: { userId },
            select: { role: true }, // We only need the current user's role
          },
        },
      }),
      this.prisma.room.count({ where: whereCondition }),
    ]);

    return { rooms, total };
  }

  /**
   * Gets detailed room info.
   */
  async findRoomDetails(roomId: string) {
    return this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        settings: true,
        treasuryAccount: true,
        _count: {
          select: { members: { where: { status: MemberStatus.ACTIVE } } },
        },
      },
    });
  }

  /**
   * Atomically updates a room and its settings in a single transaction.
   */
  async updateRoomAndSettings(
    roomId: string,
    data: {
      name?: string;
      description?: string;
      allowNegativeTreasury?: boolean;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Update the Room table (name, description)
      const roomUpdateData: any = {};
      if (data.name !== undefined) roomUpdateData.name = data.name;
      if (data.description !== undefined) roomUpdateData.description = data.description;

      let room;
      if (Object.keys(roomUpdateData).length > 0) {
        room = await tx.room.update({
          where: { id: roomId },
          data: roomUpdateData,
        });
      } else {
        room = await tx.room.findUniqueOrThrow({ where: { id: roomId } });
      }

      // 2. Update the RoomSettings table (allowNegativeTreasury)
      let settings;
      if (data.allowNegativeTreasury !== undefined) {
        settings = await tx.roomSettings.update({
          where: { roomId },
          data: { allowNegativeTreasury: data.allowNegativeTreasury },
        });
      } else {
        settings = await tx.roomSettings.findUniqueOrThrow({ where: { roomId } });
      }

      return { room, settings };
    });
  }
}
