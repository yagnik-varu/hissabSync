import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { clearDatabase } from './e2e-setup';

describe('RBAC Matrix (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let adminToken: string;
  let accountantToken: string;
  let memberToken: string;
  
  let roomId: string;
  let roomCode: string;
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
    app.useGlobalFilters(new AllExceptionsFilter());
    
    prisma = app.get<PrismaService>(PrismaService);
    await app.init();
    await clearDatabase(prisma);

    // Setup: Create 3 users (Admin, Accountant, Member)
    const registerUser = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ fullName: email.split('@')[0], email, password: 'Password123!', phone: '+919000000000' })
        .expect(201);
      return res.body.data.accessToken;
    };

    adminToken = await registerUser('admin@test.com');
    accountantToken = await registerUser('accountant@test.com');
    memberToken = await registerUser('member@test.com');

    // Admin creates room
    const roomRes = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'RBAC Room', currencyCode: 'USD', allowNegativeTreasury: true })
      .expect(201);
    
    roomId = roomRes.body.data.id;
    roomCode = roomRes.body.data.roomCode;

    // Others join
    await request(app.getHttpServer()).post('/rooms/join').set('Authorization', `Bearer ${accountantToken}`).send({ roomCode }).expect(201);
    await request(app.getHttpServer()).post('/rooms/join').set('Authorization', `Bearer ${memberToken}`).send({ roomCode }).expect(201);

    // Admin approves join requests
    const joinReqs = await request(app.getHttpServer()).get(`/rooms/${roomId}/join-requests`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    for (const req of joinReqs.body.data) {
      await request(app.getHttpServer()).patch(`/rooms/${roomId}/join-requests/${req.id}/approve`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    }

    // Admin promotes Accountant
    const members = await request(app.getHttpServer()).get(`/rooms/${roomId}/members`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    const accountantUser = members.body.data.find((m: any) => m.user.email === 'accountant@test.com');
    
    await request(app.getHttpServer())
      .patch(`/rooms/${roomId}/members/${accountantUser.userId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ACCOUNTANT' })
      .expect(200);
      
    // Setup a category and an expense to test approval matrix
    const catRes = await request(app.getHttpServer()).post(`/rooms/${roomId}/categories`).set('Authorization', `Bearer ${adminToken}`).send({ name: 'Food' }).expect(201);
    
    const expRes = await request(app.getHttpServer())
      .post(`/rooms/${roomId}/expenses`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ categoryId: catRes.body.data.id, amount: '50.00', title: 'Lunch' })
      .expect(201);
      
    expenseId = expRes.body.data.id;
  });

  afterAll(async () => {
    await clearDatabase(prisma);
    await app.close();
  });

  describe('MEMBER Role Constraints', () => {
    it('Cannot change room settings', async () => {
      await request(app.getHttpServer())
        .patch(`/rooms/${roomId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Hacked Room' })
        .expect(403);
    });

    it('Cannot view audit logs', async () => {
      await request(app.getHttpServer())
        .get(`/rooms/${roomId}/audit-logs`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('Cannot approve expenses', async () => {
      await request(app.getHttpServer())
        .patch(`/rooms/${roomId}/expenses/${expenseId}/approve`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });
    
    it('Can view expenses', async () => {
      await request(app.getHttpServer())
        .get(`/rooms/${roomId}/expenses`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
    });
  });

  describe('ACCOUNTANT Role Constraints', () => {
    it('Cannot change room settings', async () => {
      await request(app.getHttpServer())
        .patch(`/rooms/${roomId}`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({ name: 'Hacked Room' })
        .expect(403);
    });

    it('Cannot view audit logs', async () => {
      await request(app.getHttpServer())
        .get(`/rooms/${roomId}/audit-logs`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(403);
    });

    it('Can approve expenses', async () => {
      await request(app.getHttpServer())
        .patch(`/rooms/${roomId}/expenses/${expenseId}/approve`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);
    });
  });

  describe('ADMIN Role Constraints', () => {
    it('Can change room settings', async () => {
      await request(app.getHttpServer())
        .patch(`/rooms/${roomId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Admin Renamed Room' })
        .expect(200);
    });

    it('Can view audit logs', async () => {
      await request(app.getHttpServer())
        .get(`/rooms/${roomId}/audit-logs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});
