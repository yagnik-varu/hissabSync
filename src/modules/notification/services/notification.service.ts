import { Injectable, Logger } from '@nestjs/common';
import { NotificationRepository } from '../repositories/notification.repository';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly notificationRepo: NotificationRepository) {}

  /**
   * Core capability to create a notification in the database.
   * Separated from event listeners to allow generic direct usage.
   * 
   * @param userId The recipient user ID
   * @param roomId The room context (can be null for system-wide notifications)
   * @param title Notification title
   * @param message Detailed notification text
   */
  async create(userId: string, roomId: string | null, title: string, message: string) {
    this.logger.log(`Creating notification for user ${userId}: ${title}`);
    return this.notificationRepo.createNotification(userId, roomId, title, message);
  }
}
