import { Injectable } from '@nestjs/common';

import { MemberRepository } from '../repositories/member.repository';

/**
 * Business logic for membership and join-request flows:
 * join via code, approve/reject join requests, update roles,
 * leave requests, last-admin safeguard (BR-007).
 *
 * Implementation will be added in Phase 3.
 */
@Injectable()
export class MemberService {
  constructor(private readonly memberRepository: MemberRepository) {}

  async getRoomMembers(roomId: string) {
    const members = await this.memberRepository.findRoomMembers(roomId);
    
    return members.map((member) => ({
      userId: member.userId,
      fullName: member.user.fullName,
      role: member.role,
      status: member.status,
      joinedAt: member.joinedAt,
    }));
  }
}
