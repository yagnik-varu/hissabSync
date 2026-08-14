import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { ReimbursementRepository } from '../repositories/reimbursement.repository';
import { EventNames } from '../../../events/event-names';
import type { DomainEventEnvelope, ExpenseApprovedPayload, ReimbursementCreatedPayload } from '../../../events/payloads';
import { randomUUID } from 'crypto';

@Injectable()
export class ReimbursementService {
  private readonly logger = new Logger(ReimbursementService.name);

  constructor(
    private readonly reimbursementRepository: ReimbursementRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(EventNames.EXPENSE_APPROVED, { async: true })
  async handleExpenseApproved(event: DomainEventEnvelope<ExpenseApprovedPayload>) {
    this.logger.log(`Received ${EventNames.EXPENSE_APPROVED} for expense ${event.payload.expenseId}`);
    try {
      const { expenseId, roomId, submittedBy, amount } = event.payload;

      const reimbursement = await this.reimbursementRepository.createPendingReimbursement({
        expenseId,
        roomId,
        beneficiaryId: submittedBy,
        amount,
      });

      this.logger.log(`Auto-created Reimbursement ${reimbursement.id} for expense ${expenseId}`);

      const createdEvent: DomainEventEnvelope<ReimbursementCreatedPayload> = {
        eventId: randomUUID(),
        eventName: EventNames.REIMBURSEMENT_CREATED,
        aggregateId: reimbursement.id,
        roomId: roomId,
        actorId: 'system', // Automatically triggered by system policy
        occurredAt: new Date().toISOString(),
        payload: {
          reimbursementId: reimbursement.id,
          expenseId: expenseId,
          roomId: roomId,
          beneficiaryId: submittedBy,
          amount: amount,
        },
        metadata: {
          correlationId: event.metadata.correlationId || randomUUID(),
          sourceModule: 'reimbursement',
        },
      };

      this.eventEmitter.emit(EventNames.REIMBURSEMENT_CREATED, createdEvent);
    } catch (error) {
      this.logger.error(`Failed to auto-create reimbursement for expense ${event.payload.expenseId}`, error);
    }
  }
}
