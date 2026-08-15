import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../services/audit.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RoomMemberGuard } from '../../../common/guards/room-member.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { GetRoomActivityDto } from '../dto/get-room-activity.dto';

@ApiTags('Audit & Activity')
@Controller('rooms/:roomId/activity')
@UseGuards(JwtAuthGuard, RoomMemberGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.MEMBER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get room activity feed' })
  @ApiResponse({ status: 200, description: 'Room activity feed retrieved successfully' })
  async getRoomActivity(
    @Param('roomId') roomId: string,
    @Query() query: GetRoomActivityDto,
  ) {
    const result = await this.auditService.getRoomActivityFeed(
      roomId,
      query.dateFrom,
      query.dateTo,
      query.page,
      query.limit,
    );

    return {
      success: true,
      message: 'Data retrieved successfully',
      ...result,
    };
  }
}
