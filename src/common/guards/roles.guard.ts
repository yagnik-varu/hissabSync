import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';
import { RoomContext } from '../types/room-context.type';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No specific roles required
    }

    const request = context.switchToHttp().getRequest();
    const room = request.room as RoomContext;

    if (!room) {
      // RolesGuard must run after RoomMemberGuard
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSION',
        message: 'Room context not found. Ensure RoomMemberGuard runs before RolesGuard.',
      });
    }

    const hasRole = requiredRoles.includes(room.role);

    if (!hasRole) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSION',
        message: 'User does not have the required role to perform this action.',
      });
    }

    return true;
  }
}
