import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectExpenseDto {
  @ApiProperty({
    example: 'Receipt missing or unreadable.',
    description: 'The reason for rejecting the expense',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  rejectionReason!: string;
}
