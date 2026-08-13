import { NotFoundException, ForbiddenException, BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ExpenseRepository } from '../repositories/expense.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CategoryService } from '../../category/services/category.service';
import { EventNames } from '../../../events/event-names';
import type { ExpenseSubmittedPayload } from '../../../events/payloads/expense-submitted.payload';
import type { ExpenseCancelledPayload } from '../../../events/payloads/expense-cancelled.payload';
import type { SubmitExpenseDto } from '../dto/submit-expense.dto';
import type { ListExpensesDto } from '../dto/list-expenses.dto';

import { randomUUID } from 'crypto';
import type { DomainEventEnvelope } from '../../../events/payloads/domain-event.envelope';

@Injectable()
export class ExpenseService {
  private readonly logger = new Logger(ExpenseService.name);

  constructor(
    private readonly expenseRepository: ExpenseRepository,
    private readonly categoryService: CategoryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async submitExpense(roomId: string, submitterId: string, dto: SubmitExpenseDto) {
    // 1. Strict validation: category must exist IN THIS ROOM
    await this.categoryService.verifyCategoryExists(roomId, dto.categoryId);

    // 2. Create the PENDING expense
    const expense = await this.expenseRepository.createExpense(roomId, submitterId, dto);

    // 3. Emit Domain Event for side-effects (e.g. Audit, Notification)
    const eventPayload: DomainEventEnvelope<ExpenseSubmittedPayload> = {
      eventId: randomUUID(),
      eventName: EventNames.EXPENSE_SUBMITTED,
      aggregateId: expense.id,
      roomId,
      actorId: submitterId,
      occurredAt: new Date().toISOString(),
      payload: {
        expenseId: expense.id,
        roomId,
        submittedBy: submitterId,
        amount: dto.amount,
        title: dto.title,
      },
      metadata: {
        correlationId: randomUUID(),
        sourceModule: 'expense',
      },
    };

    this.eventEmitter.emit(EventNames.EXPENSE_SUBMITTED, eventPayload);

    return expense;
  }

  async listExpenses(roomId: string, filters: ListExpensesDto) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const { data, total } = await this.expenseRepository.findAllExpenses(roomId, filters, skip, limit);

    return {
      data,
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

  async getExpenseDetails(roomId: string, expenseId: string) {
    const expense = await this.expenseRepository.findExpenseById(roomId, expenseId);
    if (!expense) {
      throw new NotFoundException({
        code: 'EXPENSE_NOT_FOUND',
        message: 'Expense record does not exist in this room.',
      });
    }
    return expense;
  }

  async cancelExpense(roomId: string, userId: string, expenseId: string) {
    const expense = await this.expenseRepository.findExpenseById(roomId, expenseId);

    if (!expense) {
      throw new NotFoundException({
        code: 'EXPENSE_NOT_FOUND',
        message: 'Expense record does not exist in this room.',
      });
    }

    // Access control check: Only the submitter can cancel
    if (expense.submittedBy !== userId) {
      throw new ForbiddenException({
        code: 'EXPENSE_ACCESS_DENIED',
        message: 'You can only cancel your own expenses.',
      });
    }

    // Precondition check: Must be PENDING
    if (expense.status !== 'PENDING') {
      throw new BadRequestException({
        code: 'EXPENSE_CANNOT_CANCEL',
        message: 'Only PENDING expenses can be cancelled.',
      });
    }

    const updated = await this.expenseRepository.updateExpenseStatus(expenseId, 'CANCELLED');

    const eventPayload: DomainEventEnvelope<ExpenseCancelledPayload> = {
      eventId: randomUUID(),
      eventName: EventNames.EXPENSE_CANCELLED,
      aggregateId: expense.id,
      roomId,
      actorId: userId,
      occurredAt: new Date().toISOString(),
      payload: {
        expenseId: expense.id,
        roomId,
        cancelledBy: userId,
      },
      metadata: {
        correlationId: randomUUID(),
        sourceModule: 'expense',
      },
    };

    this.eventEmitter.emit(EventNames.EXPENSE_CANCELLED, eventPayload);

    return updated;
  }
}
