import { IsOptional, IsEnum, IsInt, Min, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReimbursementStatus } from '../../../../generated/prisma/client/enums';

export class ListReimbursementsDto {
  @ApiPropertyOptional({ enum: ReimbursementStatus })
  @IsOptional()
  @IsEnum(ReimbursementStatus)
  status?: ReimbursementStatus;

  @ApiPropertyOptional({ description: 'Filter by Beneficiary User ID' })
  @IsOptional()
  @IsUUID()
  beneficiaryId?: string;

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
