import { Injectable } from '@nestjs/common';

/**
 * Core business logic for Room lifecycle:
 * create, update settings, archive, generate room codes.
 *
 * Orchestrates RoomRepository calls and emits domain events.
 * Implementation will be added in Phase 3.
 */
@Injectable()
export class RoomService {}
