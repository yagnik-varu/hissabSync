import { Injectable } from '@nestjs/common';
import { PrismaClient } from '../../../../generated/prisma/client/client';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(data: { fullName: string; email: string; passwordHash: string; phone?: string }) {
    return this.prisma.user.create({ data });
  }

  async storeRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
    return this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }
}
