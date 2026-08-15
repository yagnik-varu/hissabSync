import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import { NotificationService } from '../../src/modules/notification/services/notification.service';

describe('NotificationModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let notificationService: NotificationService;
  let testUserId: string;
  let testRoomId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    notificationService = app.get<NotificationService>(NotificationService);

    // Create test user and room
    const user = await prisma.user.create({
      data: {
        fullName: 'Test User',
        email: `test-${Date.now()}@test.com`,
        passwordHash: 'hashedpassword',
        isActive: true,
      },
    });

    const room = await prisma.room.create({
      data: {
        name: 'Test Room',
        roomCode: `T-${Date.now()}`,
        createdBy: user.id,
        status: 'ACTIVE',
      },
    });
    testUserId = user.id;
    testRoomId = room.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should successfully create a notification row directly via service', async () => {
    const title = 'Direct Test';
    const message = 'Testing NotificationService.create directly';

    const result = await notificationService.create(testUserId, testRoomId, title, message);

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.userId).toBe(testUserId);
    expect(result.roomId).toBe(testRoomId);
    expect(result.title).toBe(title);
    expect(result.message).toBe(message);
    expect(result.isRead).toBe(false);

    // Verify it exists in the database
    const dbRow = await prisma.notification.findUnique({
      where: { id: result.id },
    });
    expect(dbRow).not.toBeNull();
    expect(dbRow?.title).toBe(title);
  });
});
