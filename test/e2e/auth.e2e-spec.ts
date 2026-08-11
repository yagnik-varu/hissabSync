import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({
      where: { user: { email: { contains: 'e2e@example.com' } } }
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'e2e@example.com' } }
    });
    await app.close();
  });

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany({
      where: { user: { email: { contains: 'e2e@example.com' } } }
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'e2e@example.com' } }
    });
  });

  describe('/auth/register (POST)', () => {
    it('should register a user', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Test User',
          email: 'teste2e@example.com',
          phone: '9876543210',
          password: 'Password123!',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.accessToken).toBeDefined();
        });
    });

    it('should return AUTH_EMAIL_ALREADY_EXISTS', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Test User',
          email: 'teste2e@example.com',
          phone: '9876543210',
          password: 'Password123!',
        });

      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Test User 2',
          email: 'teste2e@example.com',
          phone: '9876543211',
          password: 'Password123!',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('AUTH_EMAIL_ALREADY_EXISTS');
        });
    });
  });

  describe('/auth/login (POST)', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Test User',
          email: 'logine2e@example.com',
          phone: '1231231234',
          password: 'Password123!',
        });
    });

    it('should login and return tokens', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'logine2e@example.com',
          password: 'Password123!',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.accessToken).toBeDefined();
          expect(res.body.data.refreshToken).toBeDefined();
        });
    });

    it('should return AUTH_INVALID_CREDENTIALS for wrong password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'logine2e@example.com',
          password: 'wrongpassword',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('AUTH_INVALID_CREDENTIALS');
        });
    });
  });

  describe('/auth/refresh (POST)', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          fullName: 'Test User',
          email: 'refreshe2e@example.com',
          phone: '5555555555',
          password: 'Password123!',
        });
      refreshToken = res.body.data.refreshToken;
    });

    it('should refresh token successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.accessToken).toBeDefined();
        });
    });

    it('should return AUTH_REFRESH_TOKEN_INVALID', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid_token' })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('AUTH_REFRESH_TOKEN_INVALID');
        });
    });
  });
});
