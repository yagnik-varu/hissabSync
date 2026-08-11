import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

/**
 * Database access layer for Room and RoomSettings tables.
 * All Prisma queries for Room-owned tables live here.
 *
 * Services call this — never PrismaClient directly (doc §4 rule 3).
 * Implementation will be added in Phase 3.
 */
@Injectable()
export class RoomRepository {
  constructor(private readonly prisma: PrismaService) {}
}
