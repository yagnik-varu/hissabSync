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
}
