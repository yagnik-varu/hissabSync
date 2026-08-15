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
}
