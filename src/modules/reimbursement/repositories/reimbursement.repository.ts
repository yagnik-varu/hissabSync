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
  async payReimbursementTx(roomId: string, reimbursementId: string, paidBy: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Lock room settings & treasury account row
      const treasury = await tx.treasuryAccount.findUniqueOrThrow({ where: { roomId } });
      const settings = await tx.roomSettings.findUniqueOrThrow({ where: { roomId } });
      const reimbursement = await tx.reimbursement.findUniqueOrThrow({ where: { id: reimbursementId } });

      if (reimbursement.roomId !== roomId) {
        throw new Error('Reimbursement does not belong to this room');
      }

      if (reimbursement.status !== 'PENDING_PAYMENT') {
        throw new Error('REIMBURSEMENT_ALREADY_PAID');
      }

      // 2. Check balance in Strict Mode
      if (!settings.allowNegativeTreasury && treasury.currentBalance.lessThan(reimbursement.amount)) {
        throw new Error('TREASURY_INSUFFICIENT_BALANCE');
      }

      // 3. Mark reimbursement paid
      const updatedReimbursement = await tx.reimbursement.update({ 
        where: { id: reimbursementId }, 
        data: { status: 'PAID', paidBy, paidAt: new Date() } 
      });

      // 4. Write immutable debit entry into ledger
      await tx.treasuryTransaction.create({
        data: {
          roomId,
          transactionType: 'DEBIT',
          referenceType: 'REIMBURSEMENT',
          referenceId: reimbursement.id,
          amount: reimbursement.amount,
          description: `Reimbursement paid to user ${reimbursement.beneficiaryId}`,
          createdBy: paidBy,
        }
      });

      // 5. Decrement materialized treasury balance
      const updatedTreasury = await tx.treasuryAccount.update({
        where: { roomId },
        data: { currentBalance: { decrement: reimbursement.amount } }
      });

      return {
        reimbursement: updatedReimbursement,
        treasuryNewBalance: updatedTreasury.currentBalance,
      };
    });
  }
}
