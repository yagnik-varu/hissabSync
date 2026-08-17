import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TreasuryService } from '../services/treasury.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RoomMemberGuard } from '../../../common/guards/room-member.guard';
import { RoomNotArchivedGuard } from '../../../common/guards/room-not-archived.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentRoom } from '../../../common/decorators/current-room.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RoomContext } from '../../../common/types/room-context.type';
import type { UserPayload } from '../../../common/types/user-payload.type';
import { ListTreasuryTransactionsDto } from '../dto/list-treasury-transactions.dto';
import { CreateAdjustmentDto } from '../dto/create-adjustment.dto';

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
      message: 'Treasury summary retrieved successfully',
      data,
    };
  }

  @Get('transactions')
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.MEMBER)
  @ApiOperation({ summary: 'List treasury transactions (Ledger)' })
  @ApiResponse({ status: 200, description: 'Treasury transactions retrieved successfully' })
  async getTransactions(
    @CurrentRoom() room: RoomContext,
    @Query() filters: ListTreasuryTransactionsDto,
  ) {
    const { data, meta } = await this.treasuryService.listTreasuryTransactions(room.id, filters);
    
    return {
      success: true,
      message: 'Treasury transactions retrieved successfully',
      data,
      meta,
    };
  }

  @Post('adjustments')
  @UseGuards(ThrottlerGuard, RoomNotArchivedGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a manual treasury adjustment (Admin only)' })
  @ApiResponse({ status: 201, description: 'Adjustment created successfully' })
  async createAdjustment(
    @CurrentRoom() room: RoomContext,
    @CurrentUser() user: UserPayload,
    @Body() dto: CreateAdjustmentDto,
  ) {
    const adjustment = await this.treasuryService.createAdjustment(room.id, user.sub, dto);
    
    return {
      success: true,
      message: 'Treasury adjustment created successfully',
      data: adjustment,
    };
  }
}
