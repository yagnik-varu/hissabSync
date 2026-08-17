import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { clearDatabase } from './e2e-setup';

describe('Member to Payout Journey (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let adminToken: string;
  let adminId: string;
  let memberToken: string;
  let memberId: string;
  let roomId: string;
  let roomCode: string;
  let categoryId: string;
  let expenseId: string;
  let reimbursementId: string;

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
    app.useGlobalFilters(new AllExceptionsFilter());
    
    prisma = app.get<PrismaService>(PrismaService);
    await app.init();
    
    await clearDatabase(prisma);
  });

  afterAll(async () => {
    await clearDatabase(prisma);
    await app.close();
  });

  it('1. Register and Login Admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Admin User',
        email: 'admin@example.com',
        password: 'Password123!',
        phone: '+919876543210',
      })
      .expect(201);
      
    adminToken = res.body.data.accessToken;
    adminId = res.body.data.user.id;
  });

  it('2. Register and Login Member', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Member User',
        email: 'member@example.com',
        password: 'Password123!',
        phone: '+919876543211',
      })
      .expect(201);
      
    memberToken = res.body.data.accessToken;
    memberId = res.body.data.user.id;
  });

  it('3. Create Room (Admin)', async () => {
    const res = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Test Room',
        description: 'Testing the journey',
        currencyCode: 'USD',
        allowNegativeTreasury: true,
      })
      .expect(201);
      
    roomId = res.body.data.id;
    roomCode = res.body.data.roomCode;
    expect(res.body.data.myRole).toBe('ADMIN');
  });

  it('4. Create Category (Admin)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/rooms/${roomId}/categories`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Groceries',
      })
      .expect(201);
      
    categoryId = res.body.data.id;
  });

  it('5. Member requests to join room', async () => {
    await request(app.getHttpServer())
      .post(`/rooms/join`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        roomCode,
      })
      .expect(201);
  });

  it('6. Admin approves join request', async () => {
    const joinReqs = await request(app.getHttpServer())
      .get(`/rooms/${roomId}/join-requests`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
      
    const requestId = joinReqs.body.data[0].id;

    await request(app.getHttpServer())
      .patch(`/rooms/${roomId}/join-requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('7. Member submits contribution', async () => {
    await request(app.getHttpServer())
      .post(`/rooms/${roomId}/contributions`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        amount: '1000.00',
        note: 'Initial fund',
      })
      .expect(201);
  });

  it('8. Admin approves contribution', async () => {
    const contribs = await request(app.getHttpServer())
      .get(`/rooms/${roomId}/contributions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
      
    const contribId = contribs.body.data[0].id;

    await request(app.getHttpServer())
      .patch(`/rooms/${roomId}/contributions/${contribId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('9. Verify Treasury Balance is 1000.00', async () => {
    const res = await request(app.getHttpServer())
      .get(`/rooms/${roomId}/treasury`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
      
    expect(res.body.data.currentBalance).toBe('1000.00');
  });

  it('10. Member submits expense', async () => {
    const res = await request(app.getHttpServer())
      .post(`/rooms/${roomId}/expenses`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        categoryId,
        amount: '200.00',
        title: 'Snacks',
        description: 'Chips and dip',
      })
      .expect(201);
      
    expenseId = res.body.data.id;
  });

  it('11. Admin approves expense (generates reimbursement)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rooms/${roomId}/expenses/${expenseId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
      
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.reimbursementInfo).toBeDefined();
    reimbursementId = res.body.data.reimbursementInfo.id;
  });

  it('12. Admin pays reimbursement', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rooms/${roomId}/reimbursements/${reimbursementId}/pay`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
      
    expect(res.body.data.status).toBe('PAID');
    // Balance should be 1000 - 200 = 800
    expect(res.body.data.treasuryNewBalance).toBe('800.00');
  });

  it('13. Verify Audit logs captured the journey', async () => {
    const res = await request(app.getHttpServer())
      .get(`/rooms/${roomId}/audit-logs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
      
    const events = res.body.data.map((log: any) => log.eventName);
    
    // We expect to see room creation, member joining, contribution, expense, reimbursement
    expect(events).toContain('room.created');
    expect(events).toContain('member.joined');
    expect(events).toContain('contribution.approved');
    expect(events).toContain('expense.approved');
    expect(events).toContain('reimbursement.paid');
  });
});
