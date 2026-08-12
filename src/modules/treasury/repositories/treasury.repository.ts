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

  /**
   * Creates a new pending contribution record for a member.
   */
  async createContribution(roomId: string, userId: string, amount: string, note?: string) {
    return this.prisma.contribution.create({
      data: {
        roomId,
        contributorId: userId,
        amount,
        note,
        status: 'PENDING',
      },
    });
  }

  /**
   * Finds a paginated list of contributions based on filters.
   */
  async findContributions(roomId: string, filters: any) {
    const { status, contributorId, dateFrom, dateTo, page, limit } = filters;
    const where: any = { roomId };
    
    if (status) where.status = status;
    if (contributorId) where.contributorId = contributorId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [data, totalItems] = await Promise.all([
      this.prisma.contribution.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contributor: { select: { id: true, fullName: true, email: true } },
        }
      }),
      this.prisma.contribution.count({ where }),
    ]);

    return { data, totalItems };
  }
}
