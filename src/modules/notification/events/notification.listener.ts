import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../services/notification.service';
import { PrismaService } from '../../../database/prisma.service';
import { EventNames } from '../../../events/event-names';
import type { DomainEventEnvelope } from '../../../events/payloads';
import { Role } from '../../../../generated/prisma/client/enums';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  private async notifyRoomAdminsAndAccountants(roomId: string, title: string, message: string) {
    const adminsAndAccountants = await this.prisma.roomMember.findMany({
      where: {
        roomId,
        role: { in: [Role.ADMIN, Role.ACCOUNTANT] },
        status: 'ACTIVE',
      },
      select: { userId: true },
    });

    for (const member of adminsAndAccountants) {
      await this.notificationService.create(member.userId, roomId, title, message);
    }
  }

  private async notifyRoomAdmins(roomId: string, title: string, message: string) {
    const admins = await this.prisma.roomMember.findMany({
      where: {
        roomId,
        role: Role.ADMIN,
        status: 'ACTIVE',
      },
      select: { userId: true },
    });

    for (const admin of admins) {
      await this.notificationService.create(admin.userId, roomId, title, message);
    }
  }

  @OnEvent(EventNames.ROOM_JOIN_REQUESTED)
  async handleRoomJoinRequested(envelope: DomainEventEnvelope<any>) {
    this.logger.log(`Handling ROOM_JOIN_REQUESTED for room ${envelope.roomId}`);
    await this.notifyRoomAdmins(
      envelope.roomId,
      'New Join Request',
      `A user has requested to join your room.`,
    );
  }

  // Not strictly in the enum, but mapping room.member.added for join approvals
  @OnEvent(EventNames.ROOM_MEMBER_ADDED)
  async handleRoomMemberAdded(envelope: DomainEventEnvelope<any>) {
    this.logger.log(`Handling ROOM_MEMBER_ADDED for user ${envelope.payload.userId}`);
    await this.notificationService.create(
      envelope.payload.userId,
      envelope.roomId,
      'Join Request Approved',
      `Your request to join the room has been approved!`,
    );
  }

  @OnEvent(EventNames.ROOM_JOIN_REJECTED)
  async handleRoomJoinRejected(envelope: DomainEventEnvelope<any>) {
    this.logger.log(`Handling ROOM_JOIN_REJECTED`);
    // Assuming the payload has userId
    if (envelope.payload?.userId) {
      await this.notificationService.create(
        envelope.payload.userId,
        envelope.roomId,
        'Join Request Rejected',
        `Your request to join the room was rejected.`,
      );
    }
  }

  @OnEvent(EventNames.EXPENSE_SUBMITTED)
  async handleExpenseSubmitted(envelope: DomainEventEnvelope<any>) {
    this.logger.log(`Handling EXPENSE_SUBMITTED for room ${envelope.roomId}`);
    await this.notifyRoomAdminsAndAccountants(
      envelope.roomId,
      'New Expense Submitted',
      `An expense of ₹${envelope.payload.amount} was submitted and awaits approval.`,
    );
  }

  @OnEvent(EventNames.EXPENSE_APPROVED)
  async handleExpenseApproved(envelope: DomainEventEnvelope<any>) {
    this.logger.log(`Handling EXPENSE_APPROVED`);
    await this.notificationService.create(
      envelope.payload.submittedBy,
      envelope.roomId,
      'Expense Approved',
      `Your expense for ₹${envelope.payload.amount} has been approved.`,
    );
  }

  @OnEvent(EventNames.EXPENSE_REJECTED)
  async handleExpenseRejected(envelope: DomainEventEnvelope<any>) {
    this.logger.log(`Handling EXPENSE_REJECTED`);
    await this.notificationService.create(
      envelope.payload.submittedBy,
      envelope.roomId,
      'Expense Rejected',
      `Your expense for ₹${envelope.payload.amount} was rejected.`,
    );
  }

  @OnEvent(EventNames.CONTRIBUTION_APPROVED)
  async handleContributionApproved(envelope: DomainEventEnvelope<any>) {
    this.logger.log(`Handling CONTRIBUTION_APPROVED`);
    await this.notificationService.create(
      envelope.payload.memberId || envelope.payload.userId || envelope.actorId, // payload varies, fallback to actor if needed, but contributor is usually the submitter
      envelope.roomId,
      'Contribution Approved',
      `Your contribution of ₹${envelope.payload.amount} has been approved.`,
    );
  }

  @OnEvent(EventNames.CONTRIBUTION_REJECTED)
  async handleContributionRejected(envelope: DomainEventEnvelope<any>) {
    this.logger.log(`Handling CONTRIBUTION_REJECTED`);
    await this.notificationService.create(
      envelope.payload.memberId || envelope.payload.userId || envelope.actorId,
      envelope.roomId,
      'Contribution Rejected',
      `Your contribution of ₹${envelope.payload.amount} was rejected.`,
    );
  }

  @OnEvent(EventNames.REIMBURSEMENT_PAID)
  async handleReimbursementPaid(envelope: DomainEventEnvelope<any>) {
    this.logger.log(`Handling REIMBURSEMENT_PAID for reimbursement ${envelope.aggregateId}`);
    
    // REIMBURSEMENT_PAID payload doesn't contain beneficiaryId, we must fetch it.
    const reimbursement = await this.prisma.reimbursement.findUnique({
      where: { id: envelope.aggregateId },
    });

    if (reimbursement) {
      await this.notificationService.create(
        reimbursement.beneficiaryId,
        envelope.roomId,
        'Reimbursement Paid',
        `Your reimbursement of ₹${reimbursement.amount} has been paid out.`,
      );
    }
  }
}
