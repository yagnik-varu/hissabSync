import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { NotificationService } from './services/notification.service';
import { NotificationRepository } from './repositories/notification.repository';
import { NotificationListener } from './events/notification.listener';

@Module({
  imports: [PrismaModule],
  providers: [NotificationService, NotificationRepository, NotificationListener],
  exports: [NotificationService],
})
export class NotificationModule {}
