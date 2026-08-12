import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, ForbiddenException, ConflictException, NotFoundException } from '@nestjs/common';
import { MemberService } from '../../src/modules/room/services/member.service';
import { MemberRepository } from '../../src/modules/room/repositories/member.repository';
import { RoomRepository } from '../../src/modules/room/repositories/room.repository';
import { Role, MemberStatus, JoinRequestStatus } from '../../generated/prisma/client/enums';

describe('MemberService', () => {
  let memberService: MemberService;
  let memberRepository: jest.Mocked<MemberRepository>;
  let roomRepository: jest.Mocked<RoomRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockMemberRepository = {
      findRoomMembers: jest.fn(),
      findJoinRequest: jest.fn(),
      createJoinRequest: jest.fn(),
      findJoinRequestsByRoomId: jest.fn(),
      findJoinRequestById: jest.fn(),
      approveJoinRequestTransaction: jest.fn(),
      rejectJoinRequest: jest.fn(),
      getMember: jest.fn(),
      countActiveAdmins: jest.fn(),
      updateMemberRole: jest.fn(),
      deactivateMember: jest.fn(),
      setLeaveRequestedStatus: jest.fn(),
      setActiveStatus: jest.fn(),
    };

    const mockRoomRepository = {
      findRoomByCode: jest.fn(),
    };

    const mockEventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemberService,
        { provide: MemberRepository, useValue: mockMemberRepository },
        { provide: RoomRepository, useValue: mockRoomRepository },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    memberService = module.get<MemberService>(MemberService);
    memberRepository = module.get(MemberRepository) as jest.Mocked<MemberRepository>;
    roomRepository = module.get(RoomRepository) as jest.Mocked<RoomRepository>;
    eventEmitter = module.get(EventEmitter2) as jest.Mocked<EventEmitter2>;
  });

  describe('ensureSafeAdminRemoval', () => {
    const roomId = 'room-1';
    const userId = 'user-1';

    it('should throw ForbiddenException if trying to modify own role/remove self', async () => {
      await expect(memberService.ensureSafeAdminRemoval(roomId, userId, userId)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if member not found', async () => {
      memberRepository.getMember.mockResolvedValue(null);
      await expect(memberService.ensureSafeAdminRemoval(roomId, userId, 'admin-2')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if trying to remove the last admin', async () => {
      memberRepository.getMember.mockResolvedValue({ role: Role.ADMIN, status: MemberStatus.ACTIVE } as any);
      memberRepository.countActiveAdmins.mockResolvedValue(1); // Only 1 admin left
      
      await expect(memberService.ensureSafeAdminRemoval(roomId, userId, 'admin-2')).rejects.toThrow(BadRequestException);
    });

    it('should pass if there is more than 1 admin', async () => {
      const member = { role: Role.ADMIN, status: MemberStatus.ACTIVE } as any;
      memberRepository.getMember.mockResolvedValue(member);
      memberRepository.countActiveAdmins.mockResolvedValue(2);
      
      const result = await memberService.ensureSafeAdminRemoval(roomId, userId, 'admin-2');
      expect(result).toEqual(member);
    });
  });

  describe('requestLeave', () => {
    it('should allow an admin to leave if they are not the last admin (bypassing self-kick check)', async () => {
      const roomId = 'r1';
      const userId = 'u1';
      const member = { id: 'm1', role: Role.ADMIN, status: MemberStatus.ACTIVE } as any;
      
      memberRepository.getMember.mockResolvedValue(member);
      memberRepository.countActiveAdmins.mockResolvedValue(2);
      memberRepository.setLeaveRequestedStatus.mockResolvedValue(member);

      await memberService.requestLeave(roomId, userId);

      expect(memberRepository.setLeaveRequestedStatus).toHaveBeenCalledWith(roomId, userId);
      expect(eventEmitter.emit).toHaveBeenCalledWith('room.leave.requested', expect.any(Object));
    });

    it('should prevent the last admin from requesting to leave', async () => {
      const roomId = 'r1';
      const userId = 'u1';
      const member = { id: 'm1', role: Role.ADMIN, status: MemberStatus.ACTIVE } as any;
      
      memberRepository.getMember.mockResolvedValue(member);
      memberRepository.countActiveAdmins.mockResolvedValue(1);

      await expect(memberService.requestLeave(roomId, userId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Join Request logic', () => {
    it('should throw ConflictException if approving an already processed request', async () => {
      memberRepository.findJoinRequestById.mockResolvedValue({ status: JoinRequestStatus.APPROVED } as any);
      await expect(memberService.approveJoinRequest('r1', 'req1', 'admin1')).rejects.toThrow(ConflictException);
    });

    it('should successfully approve a pending join request', async () => {
      memberRepository.findJoinRequestById.mockResolvedValue({ status: JoinRequestStatus.PENDING, userId: 'u1' } as any);
      memberRepository.approveJoinRequestTransaction.mockResolvedValue({
        joinRequest: { id: 'req1' },
        member: { id: 'm1', userId: 'u1', role: Role.MEMBER, status: MemberStatus.ACTIVE }
      } as any);

      await memberService.approveJoinRequest('r1', 'req1', 'admin1');
      expect(eventEmitter.emit).toHaveBeenCalledWith('room.member.added', expect.any(Object));
    });
  });
});
