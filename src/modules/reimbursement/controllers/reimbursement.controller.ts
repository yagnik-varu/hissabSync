import { Controller, Get, Patch, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReimbursementService } from '../services/reimbursement.service';
import { ListReimbursementsDto } from '../dtos/list-reimbursements.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RoomMemberGuard } from '../../../common/guards/room-member.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentRoom } from '../../../common/decorators/current-room.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RoomContext } from '../../../common/types/room-context.type';
import type { UserPayload } from '../../../common/types/user-payload.type';

@ApiTags('Reimbursements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RoomMemberGuard, RolesGuard)
@Controller('rooms/:roomId/reimbursements')
export class ReimbursementController {
  constructor(private readonly reimbursementService: ReimbursementService) {}
  
  @Get()
  @ApiOperation({ summary: 'List reimbursements in a room' })
  @ApiResponse({ status: 200, description: 'Reimbursements retrieved successfully' })
  async listReimbursements(
    @CurrentRoom() room: RoomContext,
    @Query() filters: ListReimbursementsDto,
  ) {
    const { data, meta } = await this.reimbursementService.listReimbursements(room.id, filters);
    return {
      success: true,
      message: 'Data retrieved successfully',
      data,
      meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific reimbursement' })
  @ApiResponse({ status: 200, description: 'Reimbursement retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Reimbursement not found' })
  async getReimbursementDetails(
    @CurrentRoom() room: RoomContext,
    @Param('id', ParseUUIDPipe) reimbursementId: string,
  ) {
    const reimbursement = await this.reimbursementService.getReimbursementDetails(room.id, reimbursementId);
    return {
      success: true,
      message: 'Reimbursement retrieved successfully',
      data: reimbursement,
    };
  }

  @Patch(':id/pay')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Mark Reimbursement as Paid' })
  @ApiResponse({
    status: 200,
    description: 'Reimbursement marked as paid and treasury ledger debited',
    schema: {
      example: {
        success: true,
        message: 'Reimbursement marked as paid and treasury ledger debited',
        data: {
          id: 'reimb-1234-uuid',
          status: 'PAID',
          paidAt: '2026-08-08T12:30:00.000Z',
          treasuryNewBalance: '6050.00',
        },
      },
    },
  })
  async payReimbursement(
    @CurrentRoom() room: RoomContext,
    @CurrentUser() user: UserPayload,
    @Param('id', ParseUUIDPipe) reimbursementId: string,
  ) {
    const data = await this.reimbursementService.payReimbursement(room.id, reimbursementId, user.sub);
    
    return {
      success: true,
      message: 'Reimbursement marked as paid and treasury ledger debited',
      data,
    };
  }
}
