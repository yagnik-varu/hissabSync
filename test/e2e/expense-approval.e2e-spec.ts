import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventNames } from '../../src/events/event-names';

describe('Expense Approval Workflow (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;
  let eventEmitter: EventEmitter2;

  let adminToken: string;
  let roomId: string;
  let categoryId: string;
  let expenseId: string;
  let emitSpy: jest.SpyInstance;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    
    prisma = app.get(PrismaService);
    eventEmitter = app.get(EventEmitter2);
    emitSpy = jest.spyOn(eventEmitter, 'emit');
    
    // Clean up DB before test
    await prisma.reimbursement.deleteMany().catch(() => {});
    await prisma.expense.deleteMany();
    await prisma.expenseCategory.deleteMany();
    await prisma.treasuryTransaction.deleteMany();
    await prisma.contribution.deleteMany();
    await prisma.treasuryAccount.deleteMany();
    await prisma.roomMember.deleteMany();
    await prisma.roomSettings.deleteMany();
    await prisma.room.deleteMany();
    await prisma.user.deleteMany();

    // 1. Create Admin
    const resAdmin = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Admin User',
        email: 'admin_expense2@example.com',
        phone: '2000000002',
        password: 'Password123!',
      });
    adminToken = resAdmin.body.data.accessToken;

    // 2. Create Room (Admin)
    const resRoom = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Expense Flow Room',
        currencyCode: 'USD',
      });
    roomId = resRoom.body.data.id;

    // Wait for event listener to seed categories
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    emitSpy.mockRestore();
    await prisma.reimbursement.deleteMany().catch(() => {});
    await prisma.expense.deleteMany();
    await prisma.expenseCategory.deleteMany();
    await prisma.treasuryTransaction.deleteMany();
    await prisma.contribution.deleteMany();
    await prisma.treasuryAccount.deleteMany();
    await prisma.roomMember.deleteMany();
    await prisma.roomSettings.deleteMany();
    await prisma.room.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  it('should create an expense category explicitly', async () => {
    const res = await request(app.getHttpServer())
      .post(`/rooms/${roomId}/categories`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Custom E2E Category',
      })
      .expect(201);

    categoryId = res.body.data.id;
    expect(res.body.data.name).toBe('Custom E2E Category');
  });

  it('should submit an expense using the new category', async () => {
    const res = await request(app.getHttpServer())
      .post(`/rooms/${roomId}/expenses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId,
        amount: '125.50',
        title: 'Test Expense Approval Flow',
      })
      .expect(201);

    expenseId = res.body.data.id;
    expect(res.body.data.status).toBe('PENDING');
  });

  it('should approve expense and confirm expense.approved event fired with correct payload', async () => {
    emitSpy.mockClear();

    const res = await request(app.getHttpServer())
      .patch(`/rooms/${roomId}/expenses/${expenseId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.status).toBe('APPROVED');

    // Wait a bit to let event loop tick just in case
    await new Promise(resolve => setTimeout(resolve, 50));

    // Confirm the event was emitted
    expect(emitSpy).toHaveBeenCalledWith(EventNames.EXPENSE_APPROVED, expect.objectContaining({
      eventName: EventNames.EXPENSE_APPROVED,
      aggregateId: expenseId,
      roomId: roomId,
      payload: expect.objectContaining({
        expenseId: expenseId,
        roomId: roomId,
        amount: '125.50',
      })
    }));
  });
});
