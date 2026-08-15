import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';

describe('Notification and Audit Flow (e2e)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let memberToken: string;
  let roomId: string;
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
    await app.init();
    
    prisma = app.get(PrismaService);
    
    // Clean up DB before test
    await prisma.notification.deleteMany();
    await prisma.auditLog.deleteMany();
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
        email: 'admin_flow@example.com',
        phone: '1234567890',
        password: 'Password123!',
      });
    adminToken = resAdmin.body.data.accessToken;

    // 2. Create Member
    const resMember = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Member User',
        email: 'member_flow@example.com',
        phone: '0987654321',
        password: 'Password123!',
      });
    memberToken = resMember.body.data.accessToken;

    // 3. Create Room (Admin)
    const resRoom = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Flow Room',
        currencyCode: 'USD',
      });
    roomId = resRoom.body.data.id;
    const roomCode = resRoom.body.data.roomCode;

    // Wait for event listener to seed categories
    await new Promise(resolve => setTimeout(resolve, 500));

    // 4. Member joins room
    await request(app.getHttpServer())
      .post('/rooms/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ roomCode });

    // Admin approves join
    const joinReqs = await request(app.getHttpServer())
      .get(`/rooms/${roomId}/join-requests`)
      .set('Authorization', `Bearer ${adminToken}`);
    const reqId = joinReqs.body.data[0].id;

    await request(app.getHttpServer())
      .patch(`/rooms/${roomId}/join-requests/${reqId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Wait for events to propagate
    await new Promise(resolve => setTimeout(resolve, 500));

    // Clean out initial notifications and audit logs for clean assertions
    await prisma.notification.deleteMany();
    await prisma.auditLog.deleteMany();
  });

  afterAll(async () => {
    await prisma.notification.deleteMany();
    await prisma.auditLog.deleteMany();
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

  it('should execute full expense flow and verify notifications and audit logs', async () => {
    // 1. Get Category
    const catRes = await request(app.getHttpServer())
      .get(`/rooms/${roomId}/categories`)
      .set('Authorization', `Bearer ${adminToken}`);
    categoryId = catRes.body.data[0].id;

    // --- STEP 1: Submit Expense ---
    const submitRes = await request(app.getHttpServer())
      .post(`/rooms/${roomId}/expenses`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        categoryId,
        amount: '150.00',
        title: 'Dinner',
      });
    expenseId = submitRes.body.data.id;

    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify Admin got notified of new expense (not the member)
    const adminNotifs1 = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminNotifs1.body.data.some((n: any) => n.title === 'New Expense Submitted')).toBeTruthy();


    // --- STEP 2: Approve Expense ---
    await request(app.getHttpServer())
      .patch(`/rooms/${roomId}/expenses/${expenseId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await new Promise(resolve => setTimeout(resolve, 200));

    // (a) Submitting member has a new unread notification
    const memberNotifs1 = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${memberToken}`);
    const approvalNotif = memberNotifs1.body.data.find((n: any) => n.title === 'Expense Approved');
    expect(approvalNotif).toBeDefined();
    expect(approvalNotif.isRead).toBe(false);

    // Get reimbursementId
    const reimbRes = await request(app.getHttpServer())
      .get(`/rooms/${roomId}/reimbursements`)
      .set('Authorization', `Bearer ${adminToken}`);
    reimbursementId = reimbRes.body.data[0].id;

    // --- STEP 3: Pay Reimbursement (Flexible Treasury) ---
    // Make sure we enable flexible treasury for test to pass without contributions
    await request(app.getHttpServer())
      .patch(`/rooms/${roomId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ allowNegativeTreasury: true });

    await request(app.getHttpServer())
      .patch(`/rooms/${roomId}/reimbursements/${reimbursementId}/pay`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await new Promise(resolve => setTimeout(resolve, 200));

    // Member has another new unread notification
    const memberNotifs2 = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${memberToken}`);
    const paidNotif = memberNotifs2.body.data.find((n: any) => n.title === 'Reimbursement Paid');
    expect(paidNotif).toBeDefined();
    expect(paidNotif.isRead).toBe(false);

    // (b) marking one as read doesn't affect others
    await request(app.getHttpServer())
      .patch(`/notifications/${approvalNotif.id}/read`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    const memberNotifs3 = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${memberToken}`);
    const updatedApproval = memberNotifs3.body.data.find((n: any) => n.id === approvalNotif.id);
    const updatedPaid = memberNotifs3.body.data.find((n: any) => n.id === paidNotif.id);
    
    expect(updatedApproval.isRead).toBe(true);
    expect(updatedPaid.isRead).toBe(false); // remained unread

    // (c) the room's activity feed shows the sequence of events in order
    const activityFeed = await request(app.getHttpServer())
      .get(`/rooms/${roomId}/activity`)
      .set('Authorization', `Bearer ${memberToken}`);
    
    const activities = activityFeed.body.data;
    // Order is descending by createdAt, so Paid is [0], Approved is [1]
    expect(activities).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'REIMBURSEMENT_PAID', entityType: 'REIMBURSEMENT' }),
      expect.objectContaining({ action: 'EXPENSE_APPROVED', entityType: 'EXPENSE' }),
    ]));
    
    const paidActivity = activities.find((a: any) => a.action === 'REIMBURSEMENT_PAID');
    // Expect details to have amount but no other sensitive info
    expect(paidActivity.details).toHaveProperty('amount', '150');
    expect(paidActivity.details).not.toHaveProperty('paidBy');

    // (d) the admin-only audit log endpoint shows the same events with fuller metadata
    const auditLogs = await request(app.getHttpServer())
      .get(`/rooms/${roomId}/audit-logs`)
      .set('Authorization', `Bearer ${adminToken}`);
    
    const logs = auditLogs.body.data;
    const paidLog = logs.find((l: any) => l.action === 'REIMBURSEMENT_PAID');
    
    expect(paidLog.metadata).toHaveProperty('amount', '150');
    expect(paidLog.metadata).toHaveProperty('paidBy');
  });
});
