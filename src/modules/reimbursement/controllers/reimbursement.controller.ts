import { Controller, Get, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReimbursementService } from '../services/reimbursement.service';
import { ListReimbursementsDto } from '../dtos/list-reimbursements.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RoomMemberGuard } from '../../../common/guards/room-member.guard';
import { CurrentRoom } from '../../../common/decorators/current-room.decorator';
import type { RoomContext } from '../../../common/types/room-context.type';

@ApiTags('Reimbursements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RoomMemberGuard)
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
}
