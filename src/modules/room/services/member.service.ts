import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MemberRepository } from '../repositories/member.repository';
import { RoomRepository } from '../repositories/room.repository';
import { EventNames } from '../../../events/event-names';
import { RoomJoinRequestedPayload, RoomMemberAddedPayload, RoomMemberRoleChangedPayload, RoomMemberDeactivatedPayload, RoomLeaveRequestedPayload, RoomLeaveRejectedPayload, DomainEventEnvelope } from '../../../events/payloads';
import { JoinRequestStatus, Role, MemberStatus } from '../../../../generated/prisma/client/enums';

/**
 * Business logic for membership and join-request flows:
 * join via code, approve/reject join requests, update roles,
 * leave requests, last-admin safeguard (BR-007).
 */
@Injectable()
export class MemberService {
  constructor(
    private readonly memberRepository: MemberRepository,
    private readonly roomRepository: RoomRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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

  async requestJoin(userId: string, roomCode: string) {
    const room = await this.roomRepository.findRoomByCode(roomCode);
    if (!room) {
      throw new NotFoundException({
        code: 'ROOM_NOT_FOUND',
        message: 'Room with the given code does not exist.',
      });
    }

    const existingRequest = await this.memberRepository.findJoinRequest(room.id, userId);
    if (existingRequest) {
      // Return existing request instead of erroring, or handle as conflict.
      // We will just return it.
      return existingRequest;
    }

    const joinRequest = await this.memberRepository.createJoinRequest(room.id, userId);

    this.eventEmitter.emit(EventNames.ROOM_JOIN_REQUESTED, {
      eventId: crypto.randomUUID(),
      eventName: EventNames.ROOM_JOIN_REQUESTED,
      aggregateId: joinRequest.id,
      roomId: room.id,
      actorId: userId,
      occurredAt: new Date().toISOString(),
      payload: {
        requestId: joinRequest.id,
        roomId: room.id,
        userId,
        roomCode,
      },
    } as DomainEventEnvelope<RoomJoinRequestedPayload>);

    return joinRequest;
  }

  async getJoinRequests(roomId: string) {
    return this.memberRepository.findJoinRequestsByRoomId(roomId);
  }

  private async validateJoinRequest(requestId: string) {
    const request = await this.memberRepository.findJoinRequestById(requestId);
    if (!request) {
      throw new NotFoundException({
        code: 'JOIN_REQUEST_NOT_FOUND',
        message: 'Join request does not exist.',
      });
    }
    if (request.status !== JoinRequestStatus.PENDING) {
      throw new ConflictException({
        code: 'JOIN_REQUEST_ALREADY_PROCESSED',
        message: 'Join request has already been approved or rejected.',
      });
    }
    return request;
  }

  async approveJoinRequest(roomId: string, requestId: string, adminId: string) {
    const request = await this.validateJoinRequest(requestId);

    const { joinRequest, member } = await this.memberRepository.approveJoinRequestTransaction(
      roomId,
      requestId,
      adminId,
      request.userId,
    );

    this.eventEmitter.emit(EventNames.ROOM_MEMBER_ADDED, {
      eventId: crypto.randomUUID(),
      eventName: EventNames.ROOM_MEMBER_ADDED,
      aggregateId: member.id,
      roomId,
      actorId: adminId,
      occurredAt: new Date().toISOString(),
      payload: {
        roomId,
        userId: member.userId,
        role: member.role,
        status: member.status,
      },
    } as DomainEventEnvelope<RoomMemberAddedPayload>);

    return joinRequest;
  }

  async rejectJoinRequest(roomId: string, requestId: string, adminId: string, rejectionReason?: string) {
    await this.validateJoinRequest(requestId);
    return this.memberRepository.rejectJoinRequest(requestId, adminId, rejectionReason);
  }

  async ensureSafeAdminRemoval(roomId: string, userId: string, currentAdminId?: string) {
    if (currentAdminId && userId === currentAdminId) {
      throw new ForbiddenException({
        code: 'ROOM_ADMIN_CANNOT_KICK_SELF',
        message: 'An admin cannot alter their own role or remove themselves using this endpoint.',
      });
    }

    const member = await this.memberRepository.getMember(roomId, userId);
    if (!member) {
      throw new NotFoundException({
        code: 'ROOM_MEMBER_NOT_FOUND',
        message: 'Member does not exist in this room.',
      });
    }

    if (member.role === Role.ADMIN) {
      const activeAdminsCount = await this.memberRepository.countActiveAdmins(roomId);
      if (activeAdminsCount <= 1) {
        throw new BadRequestException({
          code: 'ROOM_LAST_ADMIN_CANNOT_LEAVE',
          message: 'Cannot demote or remove the last active admin of the room.',
        });
      }
    }
    return member;
  }

  async updateRole(roomId: string, userId: string, newRole: Role, adminId: string) {
    const member = await this.ensureSafeAdminRemoval(roomId, userId, adminId);

    if (member.role === newRole) {
      return member;
    }

    const updatedMember = await this.memberRepository.updateMemberRole(roomId, userId, newRole);

    this.eventEmitter.emit(EventNames.ROOM_MEMBER_ROLE_CHANGED, {
      eventId: crypto.randomUUID(),
      eventName: EventNames.ROOM_MEMBER_ROLE_CHANGED,
      aggregateId: updatedMember.id,
      roomId,
      actorId: adminId,
      occurredAt: new Date().toISOString(),
      payload: {
        roomId,
        userId: updatedMember.userId,
        oldRole: member.role,
        newRole,
      },
    } as DomainEventEnvelope<RoomMemberRoleChangedPayload>);

    return updatedMember;
  }

  async removeMember(roomId: string, userId: string, adminId: string) {
    const member = await this.ensureSafeAdminRemoval(roomId, userId, adminId);

    const deactivatedMember = await this.memberRepository.deactivateMember(roomId, userId);

    this.eventEmitter.emit(EventNames.ROOM_MEMBER_DEACTIVATED, {
      eventId: crypto.randomUUID(),
      eventName: EventNames.ROOM_MEMBER_DEACTIVATED,
      aggregateId: deactivatedMember.id,
      roomId,
      actorId: adminId,
      occurredAt: new Date().toISOString(),
      payload: {
        roomId,
        userId: deactivatedMember.userId,
      },
    } as DomainEventEnvelope<RoomMemberDeactivatedPayload>);

    return deactivatedMember;
  }

  async requestLeave(roomId: string, userId: string) {
    // Pass undefined for currentAdminId to skip the "cannot kick self" check,
    // but still enforce the last-admin safeguard.
    await this.ensureSafeAdminRemoval(roomId, userId);

    const updatedMember = await this.memberRepository.setLeaveRequestedStatus(roomId, userId);

    this.eventEmitter.emit(EventNames.ROOM_LEAVE_REQUESTED, {
      eventId: crypto.randomUUID(),
      eventName: EventNames.ROOM_LEAVE_REQUESTED,
      aggregateId: updatedMember.id,
      roomId,
      actorId: userId,
      occurredAt: new Date().toISOString(),
      payload: {
        roomId,
        userId,
      },
    } as DomainEventEnvelope<RoomLeaveRequestedPayload>);

    return updatedMember;
  }

  async approveLeave(roomId: string, userId: string, adminId: string) {
    const member = await this.memberRepository.getMember(roomId, userId);
    if (!member || member.status !== MemberStatus.LEAVE_REQUESTED) {
      throw new ConflictException({
        code: 'ROOM_LEAVE_REQUEST_NOT_FOUND',
        message: 'Leave request not found or member is not in LEAVE_REQUESTED status.',
      });
    }

    const deactivatedMember = await this.memberRepository.deactivateMember(roomId, userId);

    this.eventEmitter.emit(EventNames.ROOM_MEMBER_DEACTIVATED, {
      eventId: crypto.randomUUID(),
      eventName: EventNames.ROOM_MEMBER_DEACTIVATED,
      aggregateId: deactivatedMember.id,
      roomId,
      actorId: adminId,
      occurredAt: new Date().toISOString(),
      payload: {
        roomId,
        userId,
      },
    } as DomainEventEnvelope<RoomMemberDeactivatedPayload>);

    return deactivatedMember;
  }

  async rejectLeave(roomId: string, userId: string, adminId: string, rejectionReason?: string) {
    const member = await this.memberRepository.getMember(roomId, userId);
    if (!member || member.status !== MemberStatus.LEAVE_REQUESTED) {
      throw new ConflictException({
        code: 'ROOM_LEAVE_REQUEST_NOT_FOUND',
        message: 'Leave request not found or member is not in LEAVE_REQUESTED status.',
      });
    }

    const activeMember = await this.memberRepository.setActiveStatus(roomId, userId);

    this.eventEmitter.emit(EventNames.ROOM_LEAVE_REJECTED, {
      eventId: crypto.randomUUID(),
      eventName: EventNames.ROOM_LEAVE_REJECTED,
      aggregateId: activeMember.id,
      roomId,
      actorId: adminId,
      occurredAt: new Date().toISOString(),
      payload: {
        roomId,
        userId,
        rejectionReason,
      },
    } as DomainEventEnvelope<RoomLeaveRejectedPayload>);

    return activeMember;
  }
}
