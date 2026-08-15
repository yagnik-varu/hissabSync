import { Controller, Get, Patch, Param, ParseUUIDPipe, UseGuards, Query } from '@nestjs/common';
import { NotificationService } from '../services/notification.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Transform, Type } from 'class-transformer';
import { IsOptional, IsBoolean, IsInt, Min } from 'class-validator';

export class GetNotificationsDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(
    @CurrentUser('id') userId: string,
    @Query() query: GetNotificationsDto,
  ) {
    const result = await this.notificationService.getUserNotifications(
      userId,
      query.isRead,
      query.page,
      query.limit,
    );
    return {
      success: true,
      message: 'Notifications retrieved successfully',
      ...result,
    };
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentUser('id') userId: string) {
    await this.notificationService.markAllAsRead(userId);
    return {
      success: true,
      message: 'All notifications marked as read',
      data: {},
    };
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.notificationService.markAsRead(userId, id);
    return {
      success: true,
      message: 'Notification marked as read',
      data: {},
    };
  }
}
