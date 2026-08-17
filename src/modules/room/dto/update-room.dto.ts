import { IsString, IsOptional, IsBoolean, MaxLength, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RoomStatus } from '../../../common/enums/room-status.enum';

/**
 * Request body for PATCH /rooms/:roomId.
 * Admin-only operation to update room details and settings.
 *
 * @see docs/06-api-design.md §3.4
 */
export class UpdateRoomDto {
  @ApiProperty({ required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  allowNegativeTreasury?: boolean;

  @ApiProperty({ required: false, enum: RoomStatus })
  @IsEnum(RoomStatus)
  @IsOptional()
  status?: RoomStatus;
}
