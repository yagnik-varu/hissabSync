import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { ReimbursementRepository } from '../repositories/reimbursement.repository';
import { EventNames } from '../../../events/event-names';
import type { DomainEventEnvelope, ExpenseApprovedPayload, ReimbursementCreatedPayload } from '../../../events/payloads';
import { randomUUID } from 'crypto';
import { ListReimbursementsDto } from '../dtos/list-reimbursements.dto';

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

  async listReimbursements(roomId: string, filters: ListReimbursementsDto) {
    const { page, limit, status, beneficiaryId } = filters;
    const skip = (page - 1) * limit;

    const { items, total } = await this.reimbursementRepository.findMany(roomId, {
      status,
      beneficiaryId,
      skip,
      take: limit,
    });

    return {
      data: items,
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: skip + limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getReimbursementDetails(roomId: string, reimbursementId: string) {
    const reimbursement = await this.reimbursementRepository.findById(roomId, reimbursementId);
    
    if (!reimbursement) {
      throw new NotFoundException({
        code: 'REIMBURSEMENT_NOT_FOUND',
        message: 'Reimbursement record not found.',
      });
    }

    return reimbursement;
  }
}
