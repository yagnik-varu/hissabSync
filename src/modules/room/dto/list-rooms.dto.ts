import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { RoomStatus } from '../../../common/enums/room-status.enum';

/**
 * Query parameters for GET /rooms.
 * Supports filtering by status and pagination.
 *
 * @see docs/06-api-design.md §3.2
 */
export class ListRoomsDto {
  @ApiProperty({ enum: RoomStatus, required: false })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @ApiProperty({ default: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiProperty({ default: 20, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 20;
}
