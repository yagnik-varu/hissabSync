import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * Handles HTTP requests for Room lifecycle operations:
 * create, update, archive, list rooms.
 *
 * Endpoint logic will be implemented in Phase 3.
 */
@ApiTags('Rooms')
@Controller('rooms')
export class RoomController {}
