import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TreasuryService } from '../services/treasury.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RoomMemberGuard } from '../../../common/guards/room-member.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentRoom } from '../../../common/decorators/current-room.decorator';
import type { RoomContext } from '../../../common/types/room-context.type';

@ApiTags('Treasury')
@ApiBearerAuth()
@Controller('rooms/:roomId/treasury')
@UseGuards(JwtAuthGuard, RoomMemberGuard, RolesGuard)
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}

  @Get()
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.MEMBER)
  @ApiOperation({ summary: 'Get Treasury Summary' })
  @ApiResponse({ status: 200, description: 'Treasury balance and aggregate totals' })
  async getTreasurySummary(@CurrentRoom() room: RoomContext) {
    const data = await this.treasuryService.getTreasurySummary(room.id);
    return {
      success: true,
      data,
    };
  }
}
