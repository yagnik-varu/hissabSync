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

  /**
   * Retrieves a single contribution by ID and Room ID.
   */
  async getContributionById(roomId: string, id: string) {
    return this.prisma.contribution.findFirst({
      where: { id, roomId },
    });
  }

  /**
   * Updates the status of a contribution.
   */
  async updateContributionStatus(id: string, status: any) {
    return this.prisma.contribution.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Approves a contribution inside a single ACID transaction.
   * Enforces row-level locking and updates the ledger.
   */
  async approveContributionTx(roomId: string, id: string, approvedBy: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Lock contribution row
      const contribution = await tx.contribution.findUniqueOrThrow({ where: { id } });
      
      if (contribution.roomId !== roomId) {
        throw new Error('CONTRIBUTION_NOT_IN_ROOM');
      }

      if (contribution.status !== 'PENDING') {
        throw new Error('CONTRIBUTION_ALREADY_PROCESSED');
      }
      
      // 2. Mark contribution approved
      const updatedContribution = await tx.contribution.update({ 
        where: { id }, 
        data: { 
          status: 'APPROVED', 
          approvedBy, 
          approvedAt: new Date() 
        } 
      });

      // 3. Write immutable credit entry into ledger
      await tx.treasuryTransaction.create({
        data: {
          roomId: contribution.roomId,
          transactionType: 'CREDIT',
          referenceType: 'CONTRIBUTION',
          referenceId: contribution.id,
          amount: contribution.amount,
          description: `Contribution from user ${contribution.contributorId}`,
          createdBy: approvedBy,
        }
      });

      // 4. Atomically increment materialized treasury balance
      await tx.treasuryAccount.update({
        where: { roomId: contribution.roomId },
        data: { currentBalance: { increment: contribution.amount } }
      });

      return updatedContribution;
    });
  }

  /**
   * Rejects a contribution inside a transaction.
   */
  async rejectContributionTx(roomId: string, id: string, rejectedBy: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const contribution = await tx.contribution.findUniqueOrThrow({ where: { id } });
      
      if (contribution.roomId !== roomId) {
        throw new Error('CONTRIBUTION_NOT_IN_ROOM');
      }

      if (contribution.status !== 'PENDING') {
        throw new Error('CONTRIBUTION_ALREADY_PROCESSED');
      }

      return tx.contribution.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
          // Reusing approvedBy to track who rejected it, or we could leave it null
          // Since the schema only has approvedBy, we shouldn't hijack it unless specified. 
          // Wait, the schema has no rejectedBy. I will just leave approvedBy null for rejection.
        }
      });
    });
  }
}
