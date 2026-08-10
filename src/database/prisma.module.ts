import { Global, Module } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client/client';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: PrismaClient,
      useClass: PrismaService,
    },
  ],
  exports: [PrismaService, PrismaClient],
})
export class PrismaModule {}
