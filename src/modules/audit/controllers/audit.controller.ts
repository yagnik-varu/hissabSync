import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../services/audit.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RoomMemberGuard } from '../../../common/guards/room-member.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { GetRoomActivityDto } from '../dto/get-room-activity.dto';
import { GetRoomAuditLogsDto } from '../dto/get-room-audit-logs.dto';

@ApiTags('Audit & Activity')
@Controller('rooms/:roomId')
@UseGuards(JwtAuthGuard, RoomMemberGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('activity')
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

  @Get('audit-logs')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get detailed room audit logs (Admin only)' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  async getRoomAuditLogs(
    @Param('roomId') roomId: string,
    @Query() query: GetRoomAuditLogsDto,
  ) {
    const result = await this.auditService.getRoomAuditLogs(
      roomId,
      query.entityType,
      query.dateFrom,
      query.dateTo,
      query.page,
      query.limit,
    );

    return {
      success: true,
      message: 'Audit logs retrieved successfully',
      ...result,
    };
  }
}
