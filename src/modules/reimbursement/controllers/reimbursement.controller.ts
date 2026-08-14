import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReimbursementService } from '../services/reimbursement.service';

@ApiTags('Reimbursements')
@Controller('rooms/:roomId/reimbursements')
export class ReimbursementController {
  constructor(private readonly reimbursementService: ReimbursementService) {}
  
  // Payout endpoint will be implemented later in Phase 6
}
