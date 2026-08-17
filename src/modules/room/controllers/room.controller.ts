import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { RoomService } from '../services/room.service';
import { CreateRoomDto } from '../dto/create-room.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RoomMemberGuard } from '../../../common/guards/room-member.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentRoom } from '../../../common/decorators/current-room.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { UserPayload } from '../../../common/types/user-payload.type';
import type { RoomContext } from '../../../common/types/room-context.type';
import { Param, Get, Query, Patch } from '@nestjs/common';
import { ListRoomsDto } from '../dto/list-rooms.dto';
import { UpdateRoomDto } from '../dto/update-room.dto';

/**
 * Handles HTTP requests for Room lifecycle operations.
 *
 * Controller responsibility = routing + request validation + response shaping.
 * No business logic here — that all lives in RoomService.
 *
 * Guard applied: JwtAuthGuard only (not RoomMemberGuard) because creating
 * a room doesn't require room membership — the room doesn't exist yet.
 *
 * @see docs/06-api-design.md §3 (Room Management Module)
 * @see docs/11-repository-structure.md §4 rule 1 (Controllers contain no business logic)
 */
@ApiTags('Rooms')
@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  /**
   * POST /rooms — Create a new room.
   *
   * The authenticated user becomes the first ADMIN member automatically.
   * A unique roomCode is generated for sharing with future members.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new room' })
  @ApiBody({
    schema: {
      example: {
        name: 'Flat 402 Boys',
        description: 'Shared apartment expense pool',
        currencyCode: 'INR',
        allowNegativeTreasury: false,
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Room created successfully with generated roomCode',
    schema: {
      example: {
        success: true,
        message: 'Room created successfully',
        data: {
          id: 'r-1234-uuid',
          name: 'Flat 402 Boys',
          roomCode: 'FLAT402',
          myRole: 'ADMIN',
          memberCount: 1,
          treasuryBalance: '0.00',
          pendingExpensesCount: 0,
          pendingContributionsCount: 0,
          settings: {
            allowNegativeTreasury: false,
            currencyCode: 'INR',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid JWT token',
  })
  async createRoom(
    @CurrentUser() user: UserPayload,
    @Body() createRoomDto: CreateRoomDto,
  ) {
    const data = await this.roomService.createRoom(user.sub, createRoomDto);
    return {
      success: true,
      message: 'Room created successfully',
      data,
    };
  }

  /**
   * GET /rooms — List rooms the current user belongs to.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my rooms' })
  async listMyRooms(
    @CurrentUser() user: UserPayload,
    @Query() query: ListRoomsDto,
  ) {
    const result = await this.roomService.listMyRooms(user.sub, query);
    return {
      success: true,
      message: 'Rooms retrieved successfully',
      ...result, // Spreads data and meta
    };
  }

  /**
   * GET /rooms/:roomId — Get room details.
   * Requires any ACTIVE member.
   */
  @Get(':roomId')
  @UseGuards(JwtAuthGuard, RoomMemberGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get room details' })
  async getRoomDetails(
    @CurrentRoom() room: RoomContext,
    @Param('roomId') roomId: string,
  ) {
    const data = await this.roomService.getRoomDetails(roomId, room.role);
    return {
      success: true,
      message: 'Room details retrieved successfully',
      data,
    };
  }

  /**
   * PATCH /rooms/:roomId — Update room details & settings.
   * Requires ADMIN role.
   */
  @Patch(':roomId')
  @UseGuards(JwtAuthGuard, RoomMemberGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update room info & settings' })
  async updateRoom(
    @Param('roomId') roomId: string,
    @Body() updateRoomDto: UpdateRoomDto,
  ) {
    const data = await this.roomService.updateRoom(roomId, updateRoomDto);
    return {
      success: true,
      message: 'Room updated successfully',
      data,
    };
  }
}
