import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, IsNumberString, Matches } from 'class-validator';

export class SubmitExpenseDto {
  @ApiProperty({
    example: 'c-1234-uuid',
    description: 'The ID of the expense category in this room',
  })
  @IsUUID()
  @IsNotEmpty()
  categoryId!: string;

  @ApiProperty({
    description: 'The amount spent as a string to preserve decimal precision',
    example: '1450.00',
  })
  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount must be a positive number with up to 2 decimal places',
  })
  amount!: string;

  @ApiProperty({
    example: 'Weekly Vegetables & Dairy',
    description: 'A short title for the expense',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({
    description: 'Optional detailed description of the expense',
    example: 'Bought from Reliance Smart',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Optional URL pointing to the uploaded receipt image or invoice',
    example: 'https://cdn.example.com/receipts/rec-01.jpg',
  })
  @IsString()
  @IsOptional()
  receiptUrl?: string;
}
