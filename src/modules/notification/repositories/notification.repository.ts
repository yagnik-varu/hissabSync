import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new notification record in the database.
   */
  async createNotification(
    userId: string,
    roomId: string | null,
    title: string,
    message: string,
  ) {
    return this.prisma.notification.create({
      data: {
        userId,
        roomId,
        title,
        message,
        isRead: false,
      },
    });
  }
}
