import { Injectable, Logger } from '@nestjs/common';
import { AuditRepository } from '../repositories/audit.repository';
import { Prisma } from '../../../../generated/prisma/client/client';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly auditRepo: AuditRepository) {}

  /**
   * Core capability to record an audit log in the database.
   * Separated from event listeners to allow generic direct usage.
   * 
   * @param actorId The user ID who performed the action
   * @param roomId The room context (can be null for system-wide events)
   * @param entityType The type of entity affected (e.g. EXPENSE, CONTRIBUTION)
   * @param entityId The ID of the affected entity
   * @param action The specific action taken (e.g. EXPENSE_APPROVED)
   * @param metadata A JSON snapshot of relevant data (e.g. old status, new status, amounts)
   */
  async record(
    actorId: string,
    roomId: string | null,
    entityType: string,
    entityId: string,
    action: string,
    metadata: Prisma.InputJsonValue = {},
  ) {
    this.logger.log(`Recording audit log: [${entityType}] ${action} by user ${actorId}`);
    return this.auditRepo.createAuditLog(actorId, roomId, entityType, entityId, action, metadata);
  }

  /**
   * Retrieves a chronological activity feed for a specific room.
   * Explicitly strips sensitive raw `metadata` before returning to prevent 
   * leaking admin-only details (like exact row locks, detailed rejections, or IP logs)
   * to standard members.
   */
  async getRoomActivityFeed(
    roomId: string,
    dateFrom?: Date,
    dateTo?: Date,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;
    const { total, data } = await this.auditRepo.getRoomActivityFeed(
      roomId,
      dateFrom,
      dateTo,
      skip,
      limit,
    );

    const mappedData = data.map((log) => {
      // Safely extract explicit fields we want to show, if any, from metadata
      // For now, we only expose the amount if it exists, stripping everything else.
      const safeDetails: Record<string, any> = {};
      if (log.metadata && typeof log.metadata === 'object' && !Array.isArray(log.metadata)) {
        if ('amount' in log.metadata) {
          safeDetails.amount = log.metadata.amount;
        }
      }

      return {
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        createdAt: log.createdAt,
        actor: {
          id: log.actor.id,
          fullName: log.actor.fullName,
        },
        details: safeDetails,
      };
    });

    return {
      data: mappedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves full detailed audit logs for a room.
   * This includes the raw `metadata` and is strictly meant for Admin access.
   */
  async getRoomAuditLogs(
    roomId: string,
    entityType?: string,
    dateFrom?: Date,
    dateTo?: Date,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;
    const { total, data } = await this.auditRepo.getRoomAuditLogs(
      roomId,
      entityType,
      dateFrom,
      dateTo,
      skip,
      limit,
    );

    const mappedData = data.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      createdAt: log.createdAt,
      actor: {
        id: log.actor.id,
        fullName: log.actor.fullName,
      },
      metadata: log.metadata,
    }));

    return {
      data: mappedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
