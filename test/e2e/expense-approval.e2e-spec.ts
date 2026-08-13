import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';

describe('Expense Approval Workflow (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let roomId: string;
  let categoryId: string;
  let expenseId: string;

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
        email: 'admin_expense@example.com',
        phone: '2000000001',
        password: 'Password123!',
      });
    adminToken = resAdmin.body.data.accessToken;

    // 2. Create Room (Admin)
    const resRoom = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Expense Room',
        currencyCode: 'USD',
      });
    roomId = resRoom.body.data.id;

    // Wait for event listener to seed categories
    await new Promise(resolve => setTimeout(resolve, 500));

    // 3. Get category ID
    const resCategories = await request(app.getHttpServer())
      .get(`/rooms/${roomId}/categories`)
      .set('Authorization', `Bearer ${adminToken}`);
    categoryId = resCategories.body.data[0].id;
  });

  afterAll(async () => {
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

  it('should submit an expense', async () => {
    const res = await request(app.getHttpServer())
      .post(`/rooms/${roomId}/expenses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId,
        amount: '125.50',
        title: 'Test Expense Approval',
      })
      .expect(201);

    expenseId = res.body.data.id;
  });

  it('should verify pending expenses count', async () => {
    const res = await request(app.getHttpServer())
      .get(`/rooms/${roomId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.pendingExpensesCount).toBe(1);
  });

  it('should approve expense and emit payload', async () => {
    await request(app.getHttpServer())
      .patch(`/rooms/${roomId}/expenses/${expenseId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Wait a bit to let event loop tick
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  it('should verify pending expenses count goes to 0', async () => {
    const res = await request(app.getHttpServer())
      .get(`/rooms/${roomId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.pendingExpensesCount).toBe(0);
  });
});
