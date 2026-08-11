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
} from '@nestjs/swagger';
import { RoomService } from '../services/room.service';
import { CreateRoomDto } from '../dto/create-room.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { UserPayload } from '../../../common/types/user-payload.type';

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
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Room created successfully with generated roomCode',
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
}
