import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ReimbursementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPendingReimbursement(data: {
    expenseId: string;
    roomId: string;
    beneficiaryId: string;
    amount: string | number | any;
  }) {
    return this.prisma.reimbursement.create({
      data: {
        expenseId: data.expenseId,
        roomId: data.roomId,
        beneficiaryId: data.beneficiaryId,
        amount: data.amount,
        status: 'PENDING_PAYMENT',
      },
    });
  }
}
