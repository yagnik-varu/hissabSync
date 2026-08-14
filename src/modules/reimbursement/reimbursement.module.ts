import { Module } from '@nestjs/common';
import { ReimbursementService } from './services/reimbursement.service';
import { ReimbursementRepository } from './repositories/reimbursement.repository';
import { ReimbursementController } from './controllers/reimbursement.controller';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReimbursementController],
  providers: [ReimbursementService, ReimbursementRepository],
  exports: [ReimbursementService],
})
export class ReimbursementModule {}
