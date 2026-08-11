import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MemberRepository } from '../repositories/member.repository';
import { RoomRepository } from '../repositories/room.repository';
import { EventNames } from '../../../events/event-names';
import { RoomJoinRequestedPayload, RoomMemberAddedPayload, DomainEventEnvelope } from '../../../events/payloads';
import { JoinRequestStatus } from '../../../../generated/prisma/client/enums';

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
}
