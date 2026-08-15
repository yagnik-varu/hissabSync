import { Module } from '@nestjs/common';
import { ReimbursementService } from './services/reimbursement.service';
import { ReimbursementRepository } from './repositories/reimbursement.repository';
import { ReimbursementController } from './controllers/reimbursement.controller';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RoomModule } from '../room/room.module';

@Module({
  imports: [PrismaModule, AuthModule, RoomModule],
  controllers: [ReimbursementController],
  providers: [ReimbursementService, ReimbursementRepository],
  exports: [ReimbursementService],
})
export class ReimbursementModule {}
