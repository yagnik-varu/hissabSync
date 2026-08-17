import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import { clearDatabase } from './e2e-setup';
import { RoomStatus } from '../../src/common/enums/room-status.enum';

describe('4. Archive Room Safeguards (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  let adminToken: string;
  let memberToken: string;
  let roomId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    await clearDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Setup: Register Admin & Member, Create Room', async () => {
    const adminRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'archive-admin@example.com',
        password: 'Password123!',
        fullName: 'Archive Admin',
        phone: '+15550000004'
      });
    
    if (adminRes.status !== 201) {
      console.log(adminRes.body);
    }
    expect(adminRes.status).toBe(201);
    adminToken = adminRes.body.data.accessToken;

    const memberRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'archive-member@example.com',
        password: 'Password123!',
        fullName: 'Archive Member',
        phone: '+15550000014'
      })
      .expect(201);
    memberToken = memberRes.body.data.accessToken;

    const roomRes = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Archive Test Room' })
      .expect(201);
    roomId = roomRes.body.data.id;

    const joinRes = await request(app.getHttpServer())
      .post('/rooms/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ roomCode: roomRes.body.data.roomCode })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/rooms/${roomId}/join-requests/${joinRes.body.data.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('2. Active Room: Can submit transactions', async () => {
    await request(app.getHttpServer())
      .post(`/rooms/${roomId}/contributions`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ amount: '500.00', referenceId: 'active-tx' })
      .expect(201);
  });

  it('3. Archive Room', async () => {
    await request(app.getHttpServer())
      .patch(`/rooms/${roomId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: RoomStatus.ARCHIVED })
      .expect(200);
  });

  it('4. Archived Room: Cannot submit new contribution', async () => {
    const res = await request(app.getHttpServer())
      .post(`/rooms/${roomId}/contributions`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ amount: '100.00', referenceId: 'archived-tx' })
      .expect(400);
      
    expect(res.body.code).toBe('ROOM_ALREADY_ARCHIVED');
  });

  it('5. Archived Room: Cannot submit new expense', async () => {
    const res = await request(app.getHttpServer())
      .post(`/rooms/${roomId}/expenses`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ amount: '100.00', title: 'Food', splitMethod: 'EQUAL', splits: [] })
      .expect(400);

    expect(res.body.code).toBe('ROOM_ALREADY_ARCHIVED');
  });

  it('6. Archived Room: GET endpoints still work', async () => {
    await request(app.getHttpServer())
      .get(`/rooms/${roomId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
  });
});
