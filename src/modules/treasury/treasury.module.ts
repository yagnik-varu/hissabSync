import { Module } from '@nestjs/common';
import { TreasuryController } from './controllers/treasury.controller';
import { ContributionController } from './controllers/contribution.controller';
import { TreasuryService } from './services/treasury.service';
import { TreasuryRepository } from './repositories/treasury.repository';

import { AuthModule } from '../auth/auth.module';
import { RoomModule } from '../room/room.module';

@Module({
  imports: [AuthModule, RoomModule],
  controllers: [TreasuryController, ContributionController],
  providers: [TreasuryService, TreasuryRepository],
  exports: [TreasuryService],
})
export class TreasuryModule {}
