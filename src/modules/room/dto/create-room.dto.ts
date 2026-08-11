import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Request body for POST /rooms.
 *
 * Maps to docs/06-api-design.md §3.1 (Create Room).
 * `currencyCode` defaults to 'INR' and `allowNegativeTreasury` defaults
 * to false at the DB level (RoomSettings), but we accept them here so the
 * user can override the defaults at creation time.
 */
export class CreateRoomDto {
  @ApiProperty({ example: 'Flat 402 Boys', description: 'Room display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'Shared apartment expense pool',
    description: 'Room description/rules',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 'INR',
    description: 'Currency code for the room treasury',
    required: false,
    default: 'INR',
  })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  currencyCode?: string;

  @ApiProperty({
    example: false,
    description: 'Whether the treasury balance can go negative',
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  allowNegativeTreasury?: boolean;
}
