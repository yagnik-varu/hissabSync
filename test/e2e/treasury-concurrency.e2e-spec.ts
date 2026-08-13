import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import { Role } from '../../generated/prisma/client/enums';

describe('Treasury Concurrency & Row-Locking (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let memberToken: string;
  
  let roomId: string;
  let contributionId: string;

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
        email: 'admin_concurrency@example.com',
        phone: '1000000001',
        password: 'Password123!',
      });
    adminToken = resAdmin.body.data.accessToken;

    // 2. Create Member
    const resMember = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Member User',
        email: 'member_concurrency@example.com',
        phone: '1000000002',
        password: 'Password123!',
      });
    memberToken = resMember.body.data.accessToken;
    
    // 3. Create Room (Admin)
    const resRoom = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Concurrency Room',
        currencyCode: 'USD',
        allowNegativeTreasury: true,
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
  });

  afterAll(async () => {
    await prisma.treasuryTransaction.deleteMany();
    await prisma.contribution.deleteMany();
    await prisma.treasuryAccount.deleteMany();
    await prisma.roomMember.deleteMany();
    await prisma.roomSettings.deleteMany();
    await prisma.room.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  it('should allow member to submit a contribution', async () => {
    const res = await request(app.getHttpServer())
      .post(`/rooms/${roomId}/contributions`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        amount: '500.00',
        note: 'Initial deposit',
      })
      .expect(201);

    contributionId = res.body.data.id;
  });

  it('should strictly prevent race conditions via row-locking when approving concurrently', async () => {
    // We send 5 approve requests simultaneously
    const approvePromises = Array.from({ length: 5 }).map(() =>
      request(app.getHttpServer())
        .patch(`/rooms/${roomId}/contributions/${contributionId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
    );

    const responses = await Promise.all(approvePromises);

    // Count how many succeeded (200 OK) vs failed (400 Bad Request / Already processed)
    const successes = responses.filter(r => r.status === 200);
    const conflicts = responses.filter(r => r.status === 400 && r.body.message === 'CONTRIBUTION_ALREADY_PROCESSED');

    // ASSERT: Exactly one request should succeed
    expect(successes.length).toBe(1);
    
    // ASSERT: The other 4 should explicitly fail due to the status check in the transaction
    expect(conflicts.length).toBe(4);

    // Check DB state
    const account = await prisma.treasuryAccount.findUnique({ where: { roomId } });
    const txs = await prisma.treasuryTransaction.findMany({ where: { referenceId: contributionId } });
    const contribution = await prisma.contribution.findUnique({ where: { id: contributionId } });

    // ASSERT: Balance was credited EXACTLY once with '500.00'
    expect(account?.currentBalance.toString()).toBe('500.00');

    // ASSERT: Ledger has EXACTLY one entry
    expect(txs.length).toBe(1);
    expect(txs[0].transactionType).toBe('CREDIT');
    expect(txs[0].amount.toString()).toBe('500.00');
    
    // ASSERT: Contribution status is APPROVED
    expect(contribution?.status).toBe('APPROVED');
  });
});
