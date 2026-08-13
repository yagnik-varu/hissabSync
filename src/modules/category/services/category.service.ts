import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CategoryRepository } from '../repositories/category.repository';
import { EventNames } from '../../../events/event-names';
import type { DomainEventEnvelope } from '../../../events/payloads/domain-event.envelope';
import type { RoomCreatedPayload } from '../../../events/payloads/room-created.payload';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(private readonly categoryRepository: CategoryRepository) {}

  /**
   * Listens for the room.created domain event and seeds the default expense categories.
   * By keeping this in CategoryModule, we maintain the architectural rule that
   * RoomModule knows nothing about Expense Categories.
   */
  @OnEvent(EventNames.ROOM_CREATED, { async: true })
  async handleRoomCreated(event: DomainEventEnvelope<RoomCreatedPayload>) {
    try {
      const { roomId } = event.payload;
      await this.categoryRepository.seedDefaultCategories(roomId);
      this.logger.log(`Seeded default expense categories for room ${roomId}`);
    } catch (error) {
      this.logger.error(`Failed to seed categories for room ${event.payload.roomId}`, error);
    }
  }
}
