import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RoomMemberGuard } from '../../../common/guards/room-member.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { UserPayload } from '../../../common/types/user-payload.type';
import { MemberService } from '../services/member.service';

/**
 * Handles HTTP requests for Room Membership operations:
 * join requests, approve/reject, role updates, leave flow.
 */
@ApiTags('Room Members')
@Controller('rooms')
@ApiBearerAuth()
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Get(':roomId/members')
  @UseGuards(JwtAuthGuard, RoomMemberGuard)
  @ApiOperation({ summary: 'List Room Members' })
  @ApiResponse({ status: 200, description: 'Members retrieved successfully' })
  async getRoomMembers(@Param('roomId') roomId: string) {
    const members = await this.memberService.getRoomMembers(roomId);
    return {
      success: true,
      message: 'Operation successful',
      data: members,
    };
  }

  @Post('join')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Join Room via Code' })
  async requestJoin(
    @CurrentUser() user: UserPayload,
    @Body('roomCode') roomCode: string,
  ) {
    const request = await this.memberService.requestJoin(user.sub, roomCode);
    return {
      success: true,
      message: 'Join request submitted',
      data: request,
    };
  }

  @Get(':roomId/join-requests')
  @UseGuards(JwtAuthGuard, RoomMemberGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'List Join Requests' })
  async listJoinRequests(@Param('roomId') roomId: string) {
    const requests = await this.memberService.getJoinRequests(roomId);
    return {
      success: true,
      message: 'Join requests retrieved',
      data: requests,
    };
  }

  @Patch(':roomId/join-requests/:requestId/approve')
  @UseGuards(JwtAuthGuard, RoomMemberGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Approve Join Request' })
  async approveJoinRequest(
    @Param('roomId') roomId: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: UserPayload,
  ) {
    const result = await this.memberService.approveJoinRequest(roomId, requestId, user.sub);
    return {
      success: true,
      message: 'Member added to room',
      data: result,
    };
  }

  @Patch(':roomId/join-requests/:requestId/reject')
  @UseGuards(JwtAuthGuard, RoomMemberGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reject Join Request' })
  async rejectJoinRequest(
    @Param('roomId') roomId: string,
    @Param('requestId') requestId: string,
    @Body('rejectionReason') rejectionReason: string,
    @CurrentUser() user: UserPayload,
  ) {
    const result = await this.memberService.rejectJoinRequest(roomId, requestId, user.sub, rejectionReason);
    return {
      success: true,
      message: 'Join request rejected',
      data: result,
    };
  }

  @Patch(':roomId/members/:userId/role')
  @UseGuards(JwtAuthGuard, RoomMemberGuard, RolesGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Change Member Role' })
  async updateMemberRole(
    @Param('roomId') roomId: string,
    @Param('userId') userId: string,
    @Body('role') role: Role,
    @CurrentUser() user: UserPayload,
  ) {
    const result = await this.memberService.updateRole(roomId, userId, role, user.sub);
    return {
      success: true,
      message: 'Member role updated successfully',
      data: result,
    };
  }

  @Delete(':roomId/members/:userId')
  @UseGuards(JwtAuthGuard, RoomMemberGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Remove / Kick Member' })
  async removeMember(
    @Param('roomId') roomId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: UserPayload,
  ) {
    const result = await this.memberService.removeMember(roomId, userId, user.sub);
    return {
      success: true,
      message: 'Member removed from room successfully',
      data: result,
    };
  }

  @Post(':roomId/leave-request')
  @UseGuards(JwtAuthGuard, RoomMemberGuard)
  @ApiOperation({ summary: 'Request Leave Room' })
  async requestLeave(
    @Param('roomId') roomId: string,
    @CurrentUser() user: UserPayload,
  ) {
    const result = await this.memberService.requestLeave(roomId, user.sub);
    return {
      success: true,
      message: 'Leave request submitted successfully',
      data: result,
    };
  }

  @Patch(':roomId/leave-requests/:requestId/approve')
  @UseGuards(JwtAuthGuard, RoomMemberGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Approve Leave Request' })
  async approveLeaveRequest(
    @Param('roomId') roomId: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: UserPayload,
  ) {
    const result = await this.memberService.approveLeave(roomId, requestId, user.sub);
    return {
      success: true,
      message: 'Leave request approved successfully',
      data: result,
    };
  }

  @Patch(':roomId/leave-requests/:requestId/reject')
  @UseGuards(JwtAuthGuard, RoomMemberGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reject Leave Request' })
  async rejectLeaveRequest(
    @Param('roomId') roomId: string,
    @Param('requestId') requestId: string,
    @Body('rejectionReason') rejectionReason: string,
    @CurrentUser() user: UserPayload,
  ) {
    const result = await this.memberService.rejectLeave(roomId, requestId, user.sub, rejectionReason);
    return {
      success: true,
      message: 'Leave request rejected successfully',
      data: result,
    };
  }
}
