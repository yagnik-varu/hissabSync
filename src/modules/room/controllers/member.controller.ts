import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * Handles HTTP requests for Room Membership operations:
 * join requests, approve/reject, role updates, leave flow.
 *
 * Endpoint logic will be implemented in Phase 3.
 */
@ApiTags('Room Members')
@Controller('rooms/:roomId/members')
export class MemberController {}
