import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
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
  async getUserNotifications(userId: string, isRead?: boolean, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [totalItems, notifications] = await this.notificationRepo.findUserNotifications(
      userId,
      isRead,
      skip,
      limit,
    );
    
    return {
      data: notifications,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        hasNextPage: skip + limit < totalItems,
        hasPreviousPage: page > 1,
      },
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const result = await this.notificationRepo.markAsRead(notificationId, userId);
    if (result.count === 0) {
      // Check if it exists at all
      const exists = await this.notificationRepo.findNotificationById(notificationId);
      if (!exists) {
        throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Notification not found' });
      }
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You can only mark your own notifications as read' });
    }
  }

  async markAllAsRead(userId: string) {
    await this.notificationRepo.markAllAsRead(userId);
  }
}
