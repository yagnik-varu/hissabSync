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
}
