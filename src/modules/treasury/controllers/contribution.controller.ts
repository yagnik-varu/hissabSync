import { Controller, Post, Get, Delete, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TreasuryService } from '../services/treasury.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RoomMemberGuard } from '../../../common/guards/room-member.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentRoom } from '../../../common/decorators/current-room.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RoomContext } from '../../../common/types/room-context.type';
import type { UserPayload } from '../../../common/types/user-payload.type';
import { SubmitContributionDto } from '../dto/submit-contribution.dto';
import { ListContributionsDto } from '../dto/list-contributions.dto';
import { RejectContributionDto } from '../dto/reject-contribution.dto';

@ApiTags('Contributions')
@ApiBearerAuth()
@Controller('rooms/:roomId/contributions')
@UseGuards(JwtAuthGuard, RoomMemberGuard, RolesGuard)
export class ContributionController {
  constructor(private readonly treasuryService: TreasuryService) {}

  @Post()
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.MEMBER)
  @ApiOperation({ summary: 'Submit a new contribution' })
  @ApiResponse({ status: 201, description: 'Contribution submitted successfully' })
  async submitContribution(
    @CurrentRoom() room: RoomContext,
    @CurrentUser() user: UserPayload,
    @Body() dto: SubmitContributionDto,
  ) {
    const contribution = await this.treasuryService.submitContribution(room.id, user.sub, dto);
    return {
      success: true,
      message: 'Contribution submitted successfully',
      data: contribution,
    };
  }

  @Get()
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.MEMBER)
  @ApiOperation({ summary: 'List contributions' })
  @ApiResponse({ status: 200, description: 'List of contributions retrieved successfully' })
  async listContributions(
    @CurrentRoom() room: RoomContext,
    @Query() filters: ListContributionsDto,
  ) {
    const { data, meta } = await this.treasuryService.listContributions(room.id, filters);
    return {
      success: true,
      message: 'Contributions retrieved successfully',
      data,
      meta,
    };
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.ACCOUNTANT, Role.MEMBER)
  @ApiOperation({ summary: 'Cancel a pending contribution' })
  @ApiResponse({ status: 200, description: 'Contribution cancelled successfully' })
  async cancelContribution(
    @CurrentRoom() room: RoomContext,
    @CurrentUser() user: UserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const contribution = await this.treasuryService.cancelContribution(room.id, user.sub, id);
    return {
      success: true,
      message: 'Contribution cancelled successfully',
      data: contribution,
    };
  }

  @Patch(':id/approve')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Approve a pending contribution' })
  @ApiResponse({ status: 200, description: 'Contribution approved successfully' })
  async approveContribution(
    @CurrentRoom() room: RoomContext,
    @CurrentUser() user: UserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const contribution = await this.treasuryService.approveContribution(room.id, id, user.sub);
    return {
      success: true,
      message: 'Contribution approved successfully',
      data: contribution,
    };
  }

  @Patch(':id/reject')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Reject a pending contribution' })
  @ApiResponse({ status: 200, description: 'Contribution rejected successfully' })
  async rejectContribution(
    @CurrentRoom() room: RoomContext,
    @CurrentUser() user: UserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectContributionDto,
  ) {
    const contribution = await this.treasuryService.rejectContribution(room.id, id, user.sub, dto.rejectionReason);
    return {
      success: true,
      message: 'Contribution rejected successfully',
      data: contribution,
    };
  }
}
