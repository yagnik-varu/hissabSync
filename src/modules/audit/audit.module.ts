import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuditService } from './services/audit.service';
import { AuditRepository } from './repositories/audit.repository';
import { AuditListener } from './events/audit.listener';
import { AuditController } from './controllers/audit.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AuditController],
  providers: [AuditService, AuditRepository, AuditListener],
  exports: [AuditService],
})
export class AuditModule {}
