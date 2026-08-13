import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RejectContributionDto {
  @ApiPropertyOptional({
    description: 'An optional reason for rejecting the contribution',
    example: 'Amount is incorrect',
  })
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
