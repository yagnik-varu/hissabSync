import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';

describe('Reimbursement Concurrency & Row-Locking (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let memberToken: string;
  let roomId: string;
  let categoryId: string;
  let memberUserId: string;
  let adminUserId: string;

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
    await prisma.reimbursement.deleteMany();
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
        email: 'admin_reimb@example.com',
        phone: '1000000010',
        password: 'Password123!',
      });
    adminToken = resAdmin.body.data.accessToken;
    adminUserId = resAdmin.body.data.user.id;

    // 2. Create Member
    const resMember = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Member User',
        email: 'member_reimb@example.com',
        phone: '1000000011',
        password: 'Password123!',
      });
    memberToken = resMember.body.data.accessToken;
    memberUserId = resMember.body.data.user.id;
    
    // 3. Create Room (Admin)
    const resRoom = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Concurrency Room Reimb',
        currencyCode: 'USD',
        allowNegativeTreasury: false, // Strict mode
      });
    roomId = resRoom.body.data.id;
    const roomCode = resRoom.body.data.roomCode;

    // 4. Member joins room
    await request(app.getHttpServer())
      .post('/rooms/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ roomCode });
      
    // Admin approves join request
    const joinReqs = await prisma.joinRequest.findMany({ where: { roomId } });
    await request(app.getHttpServer())
      .patch(`/rooms/${roomId}/join-requests/${joinReqs[0].id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'APPROVE' });

    // 5. Create category
    const catRes = await request(app.getHttpServer())
      .post(`/rooms/${roomId}/categories`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Testing' });
    categoryId = catRes.body.data.id;

    // 6. Top up treasury directly via DB for tests
    await prisma.treasuryAccount.update({
      where: { roomId },
      data: { currentBalance: 1000 },
    });
  });

  afterAll(async () => {
    await prisma.reimbursement.deleteMany();
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

  it('should prevent double payout for the same reimbursement via row-locking', async () => {
    // 1. Create a reimbursement
    const expense = await prisma.expense.create({
      data: {
        roomId,
        categoryId,
        submittedBy: memberUserId,
        amount: 300,
        title: 'Test exp 1',
        status: 'APPROVED',
        reviewedBy: adminUserId,
      }
    });

    const reimbursement = await prisma.reimbursement.create({
      data: {
        roomId,
        expenseId: expense.id,
        beneficiaryId: memberUserId,
        amount: 300,
        status: 'PENDING_PAYMENT',
      }
    });

    // We send 3 pay requests simultaneously for the exact same reimbursement
    const payPromises = Array.from({ length: 3 }).map(() =>
      request(app.getHttpServer())
        .patch(`/rooms/${roomId}/reimbursements/${reimbursement.id}/pay`)
        .set('Authorization', `Bearer ${adminToken}`)
    );

    const responses = await Promise.all(payPromises);

    const successes = responses.filter(r => r.status === 200);
    const conflicts = responses.filter(r => r.status === 409 && (r.body.error?.code === 'REIMBURSEMENT_ALREADY_PAID' || r.body.code === 'REIMBURSEMENT_ALREADY_PAID'));

    // ASSERT: Exactly one request should succeed
    expect(successes.length).toBe(1);
    
    // ASSERT: The other 2 should explicitly fail with already paid error
    expect(conflicts.length).toBe(2);

    // Check DB state
    const account = await prisma.treasuryAccount.findUnique({ where: { roomId } });
    const txs = await prisma.treasuryTransaction.findMany({ where: { referenceType: 'REIMBURSEMENT', referenceId: reimbursement.id } });
    const dbReimb = await prisma.reimbursement.findUnique({ where: { id: reimbursement.id } });

    // Treasury was 1000, one 300 payout -> 700
    expect(account?.currentBalance.toString()).toBe('700');
    // Only one ledger entry
    expect(txs.length).toBe(1);
    expect(dbReimb?.status).toBe('PAID');
  });

  it('should prevent overdrawing the treasury when paying multiple DIFFERENT reimbursements simultaneously in Strict Mode', async () => {
    // Treasury balance is now 700. We will create two reimbursements of 500 each.
    // Paying both simultaneously should result in only one succeeding (leaving 200 balance)
    // and the second one failing with TREASURY_INSUFFICIENT_BALANCE.
    
    const expenseA = await prisma.expense.create({
      data: { roomId, categoryId, submittedBy: memberUserId, amount: 500, title: 'Exp A', status: 'APPROVED', reviewedBy: adminUserId }
    });
    const reimbA = await prisma.reimbursement.create({
      data: { roomId, expenseId: expenseA.id, beneficiaryId: memberUserId, amount: 500, status: 'PENDING_PAYMENT' }
    });

    const expenseB = await prisma.expense.create({
      data: { roomId, categoryId, submittedBy: memberUserId, amount: 500, title: 'Exp B', status: 'APPROVED', reviewedBy: adminUserId }
    });
    const reimbB = await prisma.reimbursement.create({
      data: { roomId, expenseId: expenseB.id, beneficiaryId: memberUserId, amount: 500, status: 'PENDING_PAYMENT' }
    });

    // Fire payouts simultaneously for A and B
    const payPromises = [
      request(app.getHttpServer()).patch(`/rooms/${roomId}/reimbursements/${reimbA.id}/pay`).set('Authorization', `Bearer ${adminToken}`),
      request(app.getHttpServer()).patch(`/rooms/${roomId}/reimbursements/${reimbB.id}/pay`).set('Authorization', `Bearer ${adminToken}`),
    ];

    const responses = await Promise.all(payPromises);

    const successes = responses.filter(r => r.status === 200);
    const insufficientBalanceErrors = responses.filter(r => r.status === 400 && (r.body.error?.code === 'TREASURY_INSUFFICIENT_BALANCE' || r.body.code === 'TREASURY_INSUFFICIENT_BALANCE'));

    // ASSERT: Exactly one payout succeeded
    expect(successes.length).toBe(1);
    
    // ASSERT: The other payout failed because the lock on TreasuryAccount made it read the updated balance of 200, which is < 500.
    expect(insufficientBalanceErrors.length).toBe(1);

    // Check DB state
    const account = await prisma.treasuryAccount.findUnique({ where: { roomId } });
    
    // Balance is 700 - 500 = 200
    expect(account?.currentBalance.toString()).toBe('200');

    // Check that exactly one reimbursement is PAID and one is still PENDING_PAYMENT
    const finalReimbA = await prisma.reimbursement.findUnique({ where: { id: reimbA.id } });
    const finalReimbB = await prisma.reimbursement.findUnique({ where: { id: reimbB.id } });
    
    const statuses = [finalReimbA?.status, finalReimbB?.status];
    expect(statuses).toContain('PAID');
    expect(statuses).toContain('PENDING_PAYMENT');
  });
});
