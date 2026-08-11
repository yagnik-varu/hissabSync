import { Role } from '../../../generated/prisma/client/enums';

export interface RoomMemberRoleChangedPayload {
  roomId: string;
  userId: string;
  oldRole: Role;
  newRole: Role;
}
