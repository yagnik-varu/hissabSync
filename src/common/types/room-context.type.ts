import { Role } from '../enums/role.enum';
import { MembershipStatus } from '../enums/membership-status.enum';

export interface RoomContext {
  id: string;
  role: Role;
  status: MembershipStatus;
}
