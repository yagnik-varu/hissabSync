import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuditService } from './services/audit.service';
import { AuditRepository } from './repositories/audit.repository';
import { AuditListener } from './events/audit.listener';

@Module({
  imports: [PrismaModule],
  providers: [AuditService, AuditRepository, AuditListener],
  exports: [AuditService],
})
export class AuditModule {}
