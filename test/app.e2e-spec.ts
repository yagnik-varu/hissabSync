import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
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
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/test-validation (POST) should return VALIDATION_FAILED format on bad input', async () => {
    const response = await request(app.getHttpServer())
      .post('/test-validation')
      .send({ name: '', email: 'not-an-email', extraField: 'should-fail' });
      
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.message).toBe('Input validation failed on one or more fields.');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.stringContaining('name should not be empty'),
        expect.stringContaining('email must be an email'),
        expect.stringContaining('property extraField should not exist'),
      ])
    );
  });

  afterEach(async () => {
    await app.close();
  });
});
