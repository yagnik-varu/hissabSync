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
  async findUserNotifications(userId: string, isRead?: boolean, skip = 0, take = 20) {
    const where = { userId, ...(isRead !== undefined && { isRead }) };
    
    return this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
  }

  async findNotificationById(id: string) {
    return this.prisma.notification.findUnique({ where: { id } });
  }

  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
