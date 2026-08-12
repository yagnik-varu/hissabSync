import { Module } from '@nestjs/common';
import { TreasuryController } from './controllers/treasury.controller';
import { ContributionController } from './controllers/contribution.controller';
import { TreasuryService } from './services/treasury.service';
import { TreasuryRepository } from './repositories/treasury.repository';

@Module({
  controllers: [TreasuryController, ContributionController],
  providers: [TreasuryService, TreasuryRepository],
  exports: [TreasuryService],
})
export class TreasuryModule {}
