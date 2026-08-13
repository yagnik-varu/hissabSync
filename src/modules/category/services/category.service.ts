import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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

  async getCategories(roomId: string) {
    return this.categoryRepository.findAll(roomId);
  }

  /**
   * Verifies a category exists exactly within the context of the given room.
   * Prevents cross-room data leak vulnerabilities.
   */
  async verifyCategoryExists(roomId: string, categoryId: string) {
    const category = await this.categoryRepository.findById(roomId, categoryId);
    if (!category) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Expense category does not exist in this room.',
      });
    }
    return category;
  }

  async createCategory(roomId: string, name: string) {
    try {
      return await this.categoryRepository.create(roomId, name);
    } catch (error: any) {
      // Catch Prisma Unique Constraint Violation
      if (error?.code === 'P2002') {
        throw new ConflictException({
          code: 'CATEGORY_NAME_DUPLICATE',
          message: `Category with name '${name}' already exists in this room.`,
        });
      }
      throw error;
    }
  }

  async deleteCategory(roomId: string, categoryId: string) {
    try {
      await this.categoryRepository.delete(roomId, categoryId);
    } catch (error: any) {
      // Record not found
      if (error?.code === 'P2025') {
        throw new NotFoundException({
          code: 'CATEGORY_NOT_FOUND',
          message: 'Category does not exist in this room.',
        });
      }
      
      // Foreign key constraint failed (ON DELETE RESTRICT from expenses)
      if (error?.code === 'P2003') {
        throw new ConflictException({
          code: 'CATEGORY_IN_USE',
          message: 'This category cannot be deleted because it is already used by existing expenses.',
        });
      }
      throw error;
    }
  }
}
