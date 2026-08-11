import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { RoomRepository } from '../repositories/room.repository';
import { CreateRoomDto } from '../dto/create-room.dto';
import { EventNames } from '../../../events/event-names';
import type { DomainEventEnvelope } from '../../../events/payloads/domain-event.envelope';
import type { RoomCreatedPayload } from '../../../events/payloads/room-created.payload';

/**
 * Core business logic for Room lifecycle operations.
 *
 * Why does the service emit the event AFTER the transaction commits?
 * If we emitted inside the transaction and a listener failed, the whole
 * transaction (including the room creation) would roll back — even though
 * the room itself was valid. Emitting after the commit means: (a) the room
 * definitely exists, (b) listeners can safely query it, and (c) a listener
 * failure doesn't nuke the room creation.
 *
 * @see docs/03-event-storming.md §2 (Create Room command + side effects)
 * @see docs/04-system-architecture.md (service orchestration pattern)
 */
@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);

  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a new room with default settings and adds the creator as ADMIN.
   *
   * Steps:
   * 1. Generate a unique 6-to-8 character alphanumeric roomCode (FR-02.2)
   * 2. Create Room + RoomSettings + RoomMember atomically in one transaction
   * 3. Emit `room.created` domain event for downstream listeners
   *
   * @param userId - The authenticated user creating the room
   * @param dto - Room creation parameters
   * @returns The created room with settings
   */
  async createRoom(userId: string, dto: CreateRoomDto) {
    // Step 1: Generate a unique room code
    const roomCode = await this.generateUniqueRoomCode();

    // Step 2: Atomic creation of Room + Settings + Creator membership
    const { room, settings, member } =
      await this.roomRepository.createRoomWithSettingsAndMember({
        name: dto.name,
        roomCode,
        description: dto.description,
        createdBy: userId,
        currencyCode: dto.currencyCode ?? 'INR',
        allowNegativeTreasury: dto.allowNegativeTreasury ?? false,
      });

    // Step 3: Emit domain event AFTER transaction has committed
    // Why emit now even though no listener exists yet?
    // Because it decouples the Room module from needing to know (or care)
    // about what other modules need to do when a room is created. When
    // TreasuryModule (Phase 4) is built, it just subscribes to this event
    // and creates a TreasuryAccount — Room module code never changes.
    // Same for CategoryModule (Phase 5) seeding default expense categories.
    // This is the Open/Closed Principle in practice: the Room module is
    // "closed for modification, open for extension" via events.
    const event: DomainEventEnvelope<RoomCreatedPayload> = {
      eventId: randomUUID(),
      eventName: EventNames.ROOM_CREATED,
      aggregateId: room.id,
      roomId: room.id,
      actorId: userId,
      occurredAt: new Date().toISOString(),
      payload: {
        roomId: room.id,
        roomName: room.name,
        roomCode: room.roomCode,
        createdBy: userId,
        currencyCode: settings.currencyCode,
        allowNegativeTreasury: settings.allowNegativeTreasury,
      },
      metadata: {
        correlationId: randomUUID(),
        sourceModule: 'room',
      },
    };

    this.eventEmitter.emit(EventNames.ROOM_CREATED, event);
    this.logger.log(
      `Room created: ${room.name} (${room.roomCode}) by user ${userId}`,
    );

    return {
      id: room.id,
      name: room.name,
      roomCode: room.roomCode,
      description: room.description,
      status: room.status,
      createdBy: room.createdBy,
      createdAt: room.createdAt,
      myRole: member.role,
      settings: {
        currencyCode: settings.currencyCode,
        allowNegativeTreasury: settings.allowNegativeTreasury,
      },
    };
  }

  /**
   * Generates a unique 6-to-8 character alphanumeric room code.
   *
   * Why a loop with collision check?
   * With a 6-char alphanumeric code there are 36^6 ≈ 2.2 billion combinations,
   * so collisions are rare — but not impossible. The loop retries with a
   * longer code (up to 8 chars) if needed, and gives up after 10 attempts
   * as a safety valve.
   *
   * @see docs/02-domain-model.md §3 (Room entity — roomCode 6-to-8 chars)
   */
  private async generateUniqueRoomCode(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const maxAttempts = 10;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Start with 6 chars, grow to 7 then 8 if collisions happen
      const length = Math.min(6 + Math.floor(attempt / 3), 8);
      let code = '';
      for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const exists = await this.roomRepository.existsByRoomCode(code);
      if (!exists) {
        return code;
      }

      this.logger.warn(
        `Room code collision on attempt ${attempt + 1}: ${code}`,
      );
    }

    // Extremely unlikely to reach here with 36^6+ combinations
    throw new Error('Failed to generate unique room code after 10 attempts');
  }
}
