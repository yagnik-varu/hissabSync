import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RoomMemberGuard } from '../../../common/guards/room-member.guard';
import { MemberService } from '../services/member.service';

/**
 * Handles HTTP requests for Room Membership operations:
 * join requests, approve/reject, role updates, leave flow.
 */
@ApiTags('Room Members')
@Controller('rooms/:roomId/members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RoomMemberGuard)
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Get()
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
}
