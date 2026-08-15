import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { NotificationService } from './services/notification.service';
import { NotificationRepository } from './repositories/notification.repository';

@Module({
  imports: [PrismaModule],
  providers: [NotificationService, NotificationRepository],
  exports: [NotificationService],
})
export class NotificationModule {}
