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

  async findMany(
    roomId: string,
    params: {
      status?: any;
      beneficiaryId?: string;
      skip: number;
      take: number;
    }
  ) {
    const where: any = { roomId };
    
    if (params.status) {
      where.status = params.status;
    }
    
    if (params.beneficiaryId) {
      where.beneficiaryId = params.beneficiaryId;
    }

    const [items, total] = await Promise.all([
      this.prisma.reimbursement.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          beneficiary: {
            select: { id: true, fullName: true, profileImageUrl: true }
          },
          expense: {
            select: { id: true, title: true, amount: true, category: { select: { id: true, name: true } } }
          }
        }
      }),
      this.prisma.reimbursement.count({ where }),
    ]);

    return { items, total };
  }

  async findById(roomId: string, reimbursementId: string) {
    return this.prisma.reimbursement.findUnique({
      where: {
        id: reimbursementId,
        roomId: roomId,
      },
      include: {
        beneficiary: {
          select: { id: true, fullName: true, profileImageUrl: true }
        },
        expense: {
          select: { id: true, title: true, amount: true, category: { select: { id: true, name: true } } }
        },
        payer: {
          select: { id: true, fullName: true }
        }
      }
    });
  }
}

