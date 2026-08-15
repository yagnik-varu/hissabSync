import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationService } from './services/notification.service';
import { NotificationRepository } from './repositories/notification.repository';
import { NotificationListener } from './events/notification.listener';
import { NotificationController } from './controllers/notification.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationRepository, NotificationListener],
  exports: [NotificationService],
})
export class NotificationModule {}
