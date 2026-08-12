import { Module } from '@nestjs/common';
import { TreasuryController } from './controllers/treasury.controller';
import { TreasuryService } from './services/treasury.service';
import { TreasuryRepository } from './repositories/treasury.repository';

@Module({
  controllers: [TreasuryController],
  providers: [TreasuryService, TreasuryRepository],
  exports: [TreasuryService],
})
export class TreasuryModule {}
