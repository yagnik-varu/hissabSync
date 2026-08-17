import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { RoomContext } from '../types/room-context.type';
import { RoomStatus } from '../enums/room-status.enum';

/**
 * Guard that prevents operations in archived rooms.
 * Must be used AFTER RoomMemberGuard so that request.room is populated.
 */
@Injectable()
export class RoomNotArchivedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const room = (request as any).room as RoomContext;

    if (!room) {
      // If RoomMemberGuard was not run, we can't check room status. Let it pass or fail elsewhere.
      return true;
    }

    if (room.roomStatus === RoomStatus.ARCHIVED) {
      throw new BadRequestException({
        code: 'ROOM_ALREADY_ARCHIVED',
        message: 'Operation blocked because the room is archived.',
      });
    }

    return true;
  }
}
