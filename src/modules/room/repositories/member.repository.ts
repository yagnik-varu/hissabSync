import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

/**
 * Database access layer for RoomMember and JoinRequest tables.
 *
 * Implementation will be added in Phase 3.
 */
@Injectable()
export class MemberRepository {
  constructor(private readonly prisma: PrismaService) {}
}
