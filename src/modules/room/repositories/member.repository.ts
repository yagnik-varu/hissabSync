import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { JoinRequestStatus, MemberStatus, Role } from '../../../../generated/prisma/client/enums';
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

  async createJoinRequest(roomId: string, userId: string) {
    return this.prisma.joinRequest.create({
      data: {
        roomId,
        userId,
        status: JoinRequestStatus.PENDING,
      },
    });
  }

  async findJoinRequest(roomId: string, userId: string) {
    return this.prisma.joinRequest.findFirst({
      where: { roomId, userId, status: JoinRequestStatus.PENDING },
    });
  }

  async findJoinRequestsByRoomId(roomId: string) {
    return this.prisma.joinRequest.findMany({
      where: { roomId },
      include: {
        user: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findJoinRequestById(requestId: string) {
    return this.prisma.joinRequest.findUnique({
      where: { id: requestId },
    });
  }

  async rejectJoinRequest(requestId: string, reviewerId: string, rejectionReason?: string) {
    return this.prisma.joinRequest.update({
      where: { id: requestId },
      data: {
        status: JoinRequestStatus.REJECTED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        rejectionReason,
      },
    });
  }

  async approveJoinRequestTransaction(roomId: string, requestId: string, reviewerId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. UPDATE JoinRequest
      const joinRequest = await tx.joinRequest.update({
        where: { id: requestId },
        data: {
          status: JoinRequestStatus.APPROVED,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
        },
      });

      // 2. CREATE RoomMember
      const member = await tx.roomMember.create({
        data: {
          roomId,
          userId,
          role: Role.MEMBER,
          status: MemberStatus.ACTIVE,
        },
      });

      return { joinRequest, member };
    });
  }
}
