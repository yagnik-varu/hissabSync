import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuditService } from './services/audit.service';
import { AuditRepository } from './repositories/audit.repository';

@Module({
  imports: [PrismaModule],
  providers: [AuditService, AuditRepository],
  exports: [AuditService],
})
export class AuditModule {}
