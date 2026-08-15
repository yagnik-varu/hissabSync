import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditService } from '../services/audit.service';
import { EventNames } from '../../../events/event-names';
import type { DomainEventEnvelope } from '../../../events/payloads';

@Injectable()
export class AuditListener {
  private readonly logger = new Logger(AuditListener.name);

  constructor(private readonly auditService: AuditService) {}

  @OnEvent(EventNames.CONTRIBUTION_APPROVED)
  async handleContributionApproved(envelope: DomainEventEnvelope<any>) {
    this.logger.log(`Auditing CONTRIBUTION_APPROVED for contribution ${envelope.aggregateId}`);
    await this.auditService.record(
      envelope.actorId,
      envelope.roomId,
      'CONTRIBUTION',
      envelope.aggregateId,
      'CONTRIBUTION_APPROVED',
      {
        amount: envelope.payload.amount,
        contributorId: envelope.payload.memberId || envelope.payload.userId || envelope.actorId, // payload doesn't always have memberId/userId, fall back to actor
        approvedBy: envelope.payload.approvedBy || envelope.actorId,
      },
    );
  }

  @OnEvent(EventNames.EXPENSE_APPROVED)
  async handleExpenseApproved(envelope: DomainEventEnvelope<any>) {
    this.logger.log(`Auditing EXPENSE_APPROVED for expense ${envelope.aggregateId}`);
    await this.auditService.record(
      envelope.actorId,
      envelope.roomId,
      'EXPENSE',
      envelope.aggregateId,
      'EXPENSE_APPROVED',
      {
        amount: envelope.payload.amount,
        submittedBy: envelope.payload.submittedBy,
        approvedBy: envelope.payload.approvedBy || envelope.actorId,
      },
    );
  }

  @OnEvent(EventNames.REIMBURSEMENT_PAID)
  async handleReimbursementPaid(envelope: DomainEventEnvelope<any>) {
    this.logger.log(`Auditing REIMBURSEMENT_PAID for reimbursement ${envelope.aggregateId}`);
    await this.auditService.record(
      envelope.actorId,
      envelope.roomId,
      'REIMBURSEMENT',
      envelope.aggregateId,
      'REIMBURSEMENT_PAID',
      {
        amount: envelope.payload.amount,
        beneficiaryId: envelope.payload.beneficiaryId,
        paidBy: envelope.payload.paidBy || envelope.actorId,
      },
    );
  }

  @OnEvent(EventNames.TREASURY_ADJUSTMENT_CREATED)
  async handleTreasuryAdjustment(envelope: DomainEventEnvelope<any>) {
    this.logger.log(`Auditing TREASURY_ADJUSTMENT_CREATED for adjustment ${envelope.aggregateId}`);
    await this.auditService.record(
      envelope.actorId,
      envelope.roomId,
      'TREASURY_TRANSACTION',
      envelope.aggregateId,
      'TREASURY_ADJUSTMENT',
      {
        amount: envelope.payload.amount,
        transactionType: envelope.payload.transactionType,
        description: envelope.payload.description,
      },
    );
  }

  @OnEvent(EventNames.ROOM_MEMBER_ROLE_CHANGED)
  async handleRoleUpdated(envelope: DomainEventEnvelope<any>) {
    this.logger.log(`Auditing ROOM_MEMBER_ROLE_CHANGED for member ${envelope.aggregateId}`);
    await this.auditService.record(
      envelope.actorId,
      envelope.roomId,
      'ROOM_MEMBER',
      envelope.aggregateId,
      'ROLE_UPDATED',
      {
        userId: envelope.payload.userId,
        oldRole: envelope.payload.oldRole,
        newRole: envelope.payload.newRole,
      },
    );
  }
}
