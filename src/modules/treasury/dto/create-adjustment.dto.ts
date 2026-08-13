import { IsEnum, IsNotEmpty, IsNumberString, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TransactionType } from '../../../../generated/prisma/client/enums';

export class CreateAdjustmentDto {
  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  transactionType!: TransactionType;

  @ApiProperty({ description: 'Decimal string representation of the amount', example: '150.00' })
  @IsNumberString()
  amount!: string;

  @ApiProperty({ description: 'Mandatory reason/note for the manual adjustment', example: 'Reconciling cash shortage' })
  @IsString()
  @IsNotEmpty()
  description!: string;
}
