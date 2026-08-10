import { Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { UserRepository } from './repositories/user.repository';
import { PrismaClient } from '../../../generated/prisma/client/client';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    UserRepository,
    {
      provide: PrismaClient,
      useValue: new PrismaClient({ adapter: null as any }),
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
