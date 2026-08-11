import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
}
