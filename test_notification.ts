import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { NotificationService } from './src/modules/notification/services/notification.service';
import { PrismaService } from './src/database/prisma.service';

async function testNotification() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const notificationService = app.get(NotificationService);
  const prisma = app.get(PrismaService);

  try {
    // Grab any existing user and room to satisfy foreign keys
    const user = await prisma.user.findFirst();
    const room = await prisma.room.findFirst();

    if (!user || !room) {
      console.log('Seed data is missing. Please run the seeder first.');
      await app.close();
      return;
    }

    const notification = await notificationService.create(
      user.id,
      room.id,
      'Test Notification',
      'This is a test notification to verify the generic creation capability.',
    );

    console.log('Successfully created notification row:');
    console.log(notification);
  } catch (error) {
    console.error('Failed to create notification:', error);
  } finally {
    await app.close();
  }
}

testNotification();
