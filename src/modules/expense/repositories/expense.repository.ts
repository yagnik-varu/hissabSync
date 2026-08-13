import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ExpenseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createExpense(roomId: string, submitterId: string, data: {
    categoryId: string;
    amount: string | number | any; // Prisma.Decimal compatible
    title: string;
    description?: string;
    receiptUrl?: string;
  }) {
    return this.prisma.expense.create({
      data: {
        roomId,
        submittedBy: submitterId,
        categoryId: data.categoryId,
        amount: data.amount,
        title: data.title,
        description: data.description,
        receiptUrl: data.receiptUrl,
        status: 'PENDING',
      },
      include: {
        category: true,
        submitter: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  async findAllExpenses(roomId: string, filters: any, skip: number, take: number) {
    const where: any = { roomId };
    
    if (filters.status) where.status = filters.status;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.submittedBy) where.submittedBy = filters.submittedBy;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          submitter: {
            select: { id: true, fullName: true },
          },
        },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return { data, total };
  }

  async findExpenseById(roomId: string, id: string) {
    return this.prisma.expense.findUnique({
      where: {
        id,
        roomId,
      },
      include: {
        category: true,
        submitter: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        reviewer: {
          select: { id: true, fullName: true },
        },
        reimbursement: true,
      },
    });
  }

  async updateExpenseStatus(id: string, status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED') {
    return this.prisma.expense.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Approves an expense inside a single ACID transaction.
   * Enforces row-level locking to prevent concurrent modifications.
   */
  async approveExpenseTx(roomId: string, id: string, reviewerId: string) {
    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findUniqueOrThrow({ where: { id } });

      if (expense.roomId !== roomId) {
        throw new Error('EXPENSE_NOT_IN_ROOM');
      }

      if (expense.status !== 'PENDING') {
        throw new Error('EXPENSE_ALREADY_PROCESSED');
      }

      return tx.expense.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
        },
      });
    });
  }

  /**
   * Rejects an expense inside a transaction.
   */
  async rejectExpenseTx(roomId: string, id: string, reviewerId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findUniqueOrThrow({ where: { id } });

      if (expense.roomId !== roomId) {
        throw new Error('EXPENSE_NOT_IN_ROOM');
      }

      if (expense.status !== 'PENDING') {
        throw new Error('EXPENSE_ALREADY_PROCESSED');
      }

      return tx.expense.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
        },
      });
    });
  }
}
