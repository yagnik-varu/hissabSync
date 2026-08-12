import { IsString, IsOptional, IsNumberString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitContributionDto {
  @ApiProperty({
    description: 'The amount contributed as a string to preserve decimal precision',
    example: '2000.00',
  })
  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount must be a positive number with up to 2 decimal places',
  })
  amount!: string;

  @ApiPropertyOptional({
    description: 'An optional note explaining the contribution',
    example: 'August Treasury Share',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
