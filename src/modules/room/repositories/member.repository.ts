import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

/**
 * Database access layer for RoomMember and JoinRequest tables.
 *
 * Implementation will be added in Phase 3.
 */
@Injectable()
export class MemberRepository {
  constructor(private readonly prisma: PrismaService) { }

  async findRoomMembers(roomId: string) {
    return this.prisma.roomMember.findMany({
      where: { roomId },
      select: {
        userId: true,
        role: true,
        status: true,
        joinedAt: true,
        user: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'asc',
      },
    });
  }
}
