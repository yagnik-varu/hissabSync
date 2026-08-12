import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class TreasuryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new 1:1 Treasury Account for a room with an initial balance of 0.00.
   */
  async createAccount(roomId: string) {
    return this.prisma.treasuryAccount.create({
      data: {
        roomId,
        currentBalance: 0.00,
      },
    });
  }

  /**
   * Retrieves the treasury account details along with its ledger-aggregated totals.
   * We calculate totals from the immutable treasury_transactions table directly to ensure accuracy.
   */
  async getTreasurySummary(roomId: string) {
    const account = await this.prisma.treasuryAccount.findUnique({
      where: { roomId },
      include: {
        room: {
          include: {
            settings: true,
          },
        },
      },
    });

    if (!account) return null;

    // Use Prisma.Decimal safe aggregation natively
    const contributionsSum = await this.prisma.treasuryTransaction.aggregate({
      _sum: { amount: true },
      where: {
        roomId,
        transactionType: 'CREDIT',
        referenceType: 'CONTRIBUTION',
      },
    });

    const reimbursementsSum = await this.prisma.treasuryTransaction.aggregate({
      _sum: { amount: true },
      where: {
        roomId,
        transactionType: 'DEBIT',
        referenceType: 'REIMBURSEMENT',
      },
    });

    return {
      account,
      totalContributions: contributionsSum._sum.amount,
      totalReimbursements: reimbursementsSum._sum.amount,
    };
  }
}
