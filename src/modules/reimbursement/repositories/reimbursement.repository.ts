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
      // 1. Lock reimbursement and treasury account rows explicitly using FOR UPDATE
      // This forces concurrent transactions to queue and read the committed state of the winner.
      const reimbRows = await tx.$queryRaw<any[]>`SELECT "id", "status", "room_id" as "roomId", "amount", "beneficiary_id" as "beneficiaryId" FROM "reimbursements" WHERE "id" = ${reimbursementId}::uuid FOR UPDATE`;
      if (!reimbRows.length) throw new Error('No Reimbursement found');
      const reimbursement = reimbRows[0];

      if (reimbursement.roomId !== roomId) {
        throw new Error('Reimbursement does not belong to this room');
      }

      if (reimbursement.status !== 'PENDING_PAYMENT') {
        throw new Error('REIMBURSEMENT_ALREADY_PAID');
      }

      const treasuryRows = await tx.$queryRaw<any[]>`SELECT "current_balance" as "currentBalance" FROM "treasury_accounts" WHERE "room_id" = ${roomId}::uuid FOR UPDATE`;
      if (!treasuryRows.length) throw new Error('Treasury account not found');
      const treasury = treasuryRows[0];

      const settings = await tx.roomSettings.findUniqueOrThrow({ where: { roomId } });

      // 2. Check balance in Strict Mode
      // Using Prisma.Decimal for safe math since raw query returns a Decimal-like object or string in pg
      const currentBalance = Number(treasury.currentBalance);
      const amount = Number(reimbursement.amount);

      if (!settings.allowNegativeTreasury && currentBalance < amount) {
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
