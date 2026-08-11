import { Role, MemberStatus } from '../../../generated/prisma/client/enums';

export interface RoomMemberAddedPayload {
  roomId: string;
  userId: string;
  role: Role;
  status: MemberStatus;
}
