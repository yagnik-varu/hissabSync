import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TreasuryService } from '../services/treasury.service';

@ApiTags('Treasury')
@Controller('treasury')
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}
}
