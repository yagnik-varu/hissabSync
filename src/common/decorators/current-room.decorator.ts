import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RoomContext } from '../types/room-context.type';

export const CurrentRoom = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RoomContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.room;
  },
);
