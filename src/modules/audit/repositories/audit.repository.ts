import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../../generated/prisma/client/client';

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new audit log record.
   */
  async createAuditLog(
    actorId: string,
    roomId: string | null,
    entityType: string,
    entityId: string,
    action: string,
    metadata: Prisma.InputJsonValue,
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        roomId,
        entityType,
        entityId,
        action,
        metadata,
      },
    });
  }

  /**
   * Fetches the activity feed for a room, paginated and chronologically ordered.
   * Joins the actor to get their name for member-friendly display.
   */
  async getRoomActivityFeed(
    roomId: string,
    dateFrom?: Date,
    dateTo?: Date,
    skip: number = 0,
    take: number = 20,
  ) {
    const where: Prisma.AuditLogWhereInput = {
      roomId,
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      }),
    ]);

    return { total, data };
  }
}
