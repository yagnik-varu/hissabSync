import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MembershipStatus } from '../enums/membership-status.enum';
import { Role } from '../enums/role.enum';
import { RoomContext } from '../types/room-context.type';
import { UserPayload } from '../types/user-payload.type';
import { Request } from 'express';

@Injectable()
export class RoomMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user as UserPayload;
    const roomId = request.params.roomId;

    if (!user || !user.sub) {
      return false; // JwtAuthGuard should have handled this, but just in case
    }

    if (!roomId) {
      // If there's no roomId in params, this guard might be applied incorrectly,
      // or it's a route that doesn't need it. We deny by default if applied.
      throw new ForbiddenException({
        code: 'ROOM_ACCESS_DENIED',
        message: 'Room ID is required to access this resource.',
      });
    }

    const membership = await this.prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: user.sub,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException({
        code: 'ROOM_ACCESS_DENIED',
        message: 'User is not a member of the requested room.',
      });
    }

    if (membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException({
        code: 'ROOM_MEMBER_NOT_ACTIVE',
        message: 'Membership status is not active.',
      });
    }

    // Attach RoomContext to request
    (request as any).room = {
      id: membership.roomId,
      role: membership.role as Role,
      status: membership.status as MembershipStatus,
    } as RoomContext;

    return true;
  }
}
