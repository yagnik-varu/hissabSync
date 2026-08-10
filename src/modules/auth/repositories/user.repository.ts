import { Injectable } from '@nestjs/common';
import { PrismaClient } from '../../../../generated/prisma/client/client';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
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

  async findRefreshTokensByUserId(userId: string) {
    return this.prisma.refreshToken.findMany({
      where: { userId },
    });
  }

  async deleteRefreshToken(id: string) {
    return this.prisma.refreshToken.delete({
      where: { id },
    });
  }

  async updateProfile(id: string, data: { fullName?: string; phone?: string; profileImageUrl?: string }) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async updatePassword(id: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }
}
