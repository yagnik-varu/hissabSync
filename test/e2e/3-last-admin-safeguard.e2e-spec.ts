import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { clearDatabase } from './e2e-setup';

describe('Last Admin Safeguard (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let admin1Token: string;
  let admin1Id: string;
  let admin2Token: string;
  let admin2Id: string;
  
  let roomId: string;
  let roomCode: string;

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

    const registerUser = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ fullName: email.split('@')[0], email, password: 'Password123!', phone: Math.random().toString().slice(2, 12) })
        .expect(201);
      return { token: res.body.data.accessToken, id: res.body.data.user.id };
    };

    const user1 = await registerUser('admin1@test.com');
    admin1Token = user1.token;
    admin1Id = user1.id;

    const user2 = await registerUser('admin2@test.com');
    admin2Token = user2.token;
    admin2Id = user2.id;

    // Admin1 creates room
    const roomRes = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${admin1Token}`)
      .send({ name: 'Safeguard Room', currencyCode: 'USD' })
      .expect(201);
    
    roomId = roomRes.body.data.id;
    roomCode = roomRes.body.data.roomCode;
  });

  afterAll(async () => {
    await clearDatabase(prisma);
    await app.close();
  });

  it('1. Cannot downgrade the last Admin', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rooms/${roomId}/members/${admin1Id}/role`)
      .set('Authorization', `Bearer ${admin1Token}`)
      .send({ role: 'ACCOUNTANT' })
      .expect(400);

    expect(res.body.error.code).toBe('ROOM_LAST_ADMIN_ERROR');
  });

  it('2. Cannot leave if you are the last Admin', async () => {
    const res = await request(app.getHttpServer())
      .post(`/rooms/${roomId}/leave-request`)
      .set('Authorization', `Bearer ${admin1Token}`)
      .expect(400);

    expect(res.body.error.code).toBe('ROOM_LAST_ADMIN_ERROR');
  });

  it('3. Add a second member and promote to Admin', async () => {
    // Admin2 joins
    await request(app.getHttpServer()).post('/rooms/join').set('Authorization', `Bearer ${admin2Token}`).send({ roomCode }).expect(201);

    // Admin1 approves
    const joinReqs = await request(app.getHttpServer()).get(`/rooms/${roomId}/join-requests`).set('Authorization', `Bearer ${admin1Token}`).expect(200);
    const requestId = joinReqs.body.data[0].id;
    await request(app.getHttpServer()).patch(`/rooms/${roomId}/join-requests/${requestId}/approve`).set('Authorization', `Bearer ${admin1Token}`).expect(200);

    // Admin1 promotes Admin2
    await request(app.getHttpServer())
      .patch(`/rooms/${roomId}/members/${admin2Id}/role`)
      .set('Authorization', `Bearer ${admin1Token}`)
      .send({ role: 'ADMIN' })
      .expect(200);
  });

  it('4. Can now downgrade Admin1 since Admin2 is there', async () => {
    await request(app.getHttpServer())
      .patch(`/rooms/${roomId}/members/${admin1Id}/role`)
      .set('Authorization', `Bearer ${admin2Token}`)
      .send({ role: 'MEMBER' })
      .expect(200);
  });

  it('5. Can now remove Admin1', async () => {
    await request(app.getHttpServer())
      .delete(`/rooms/${roomId}/members/${admin1Id}`)
      .set('Authorization', `Bearer ${admin2Token}`)
      .expect(200);
  });
});
