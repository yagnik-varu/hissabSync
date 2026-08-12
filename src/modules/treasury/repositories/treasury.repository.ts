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
}
