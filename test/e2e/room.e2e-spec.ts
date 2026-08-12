import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import { Role, MemberStatus } from '../../generated/prisma/client/enums';

describe('RoomController Multi-Tenant Isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let tokenA: string;
  let tokenB: string;
  let userBId: string;
  
  let roomIdA: string;
  let roomIdB: string;

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
    await prisma.roomMember.deleteMany();
    await prisma.roomSettings.deleteMany();
    await prisma.room.deleteMany();
    await prisma.user.deleteMany();

    // 1. Create User A
    const resA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'User A',
        email: 'usera@example.com',
        phone: '1111111111',
        password: 'Password123!',
      });
    tokenA = resA.body.data.accessToken;

    // 2. Create User B
    const resB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'User B',
        email: 'userb@example.com',
        phone: '2222222222',
        password: 'Password123!',
      });
    tokenB = resB.body.data.accessToken;
    
    const decodedB = JSON.parse(Buffer.from(tokenB.split('.')[1], 'base64').toString());
    userBId = decodedB.sub;
  });

  afterAll(async () => {
    await prisma.roomMember.deleteMany();
    await prisma.roomSettings.deleteMany();
    await prisma.room.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  it('should create Room A for User A', async () => {
    const res = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Room A',
        currencyCode: 'USD',
        allowNegativeTreasury: true,
      })
      .expect(201);

    roomIdA = res.body.data.id;
  });

  it('should create Room B for User B', async () => {
    const res = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        name: 'Room B',
        currencyCode: 'EUR',
        allowNegativeTreasury: false,
      })
      .expect(201);

    roomIdB = res.body.data.id;
  });

  describe('Key Security Invariant #1: Multi-Tenant Isolation', () => {
    it('User A should NOT be able to view Room B details (ROOM_ACCESS_DENIED)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/rooms/${roomIdB}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(403);
      
      expect(res.body.message).toBe('ROOM_ACCESS_DENIED');
    });

    it('User A should NOT be able to perform admin action (update settings) in Room B', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/rooms/${roomIdB}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Hacked Room B',
        })
        .expect(403);
      
      expect(res.body.message).toBe('ROOM_ACCESS_DENIED');
    });
    
    it('User B should be able to view Room B details', async () => {
      await request(app.getHttpServer())
        .get(`/rooms/${roomIdB}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);
    });
  });

  describe('ROOM_MEMBER_NOT_ACTIVE check', () => {
    beforeAll(async () => {
      // Manually add User B to Room A as a LEFT member
      await prisma.roomMember.create({
        data: {
          roomId: roomIdA,
          userId: userBId,
          role: Role.MEMBER,
          status: MemberStatus.LEFT,
          leftAt: new Date(),
        },
      });
    });

    it('User B should be blocked from accessing Room A because their status is LEFT', async () => {
      const res = await request(app.getHttpServer())
        .get(`/rooms/${roomIdA}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(403);

      expect(res.body.message).toBe('ROOM_MEMBER_NOT_ACTIVE');
    });
  });
});
