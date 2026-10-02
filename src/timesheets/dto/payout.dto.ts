import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PayCurrency } from '@prisma/client';
import { PaginationQueryDto } from '../../common/pagination.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

/** Multipart fields sent with the `proof` file. */
export class CreatePayoutDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: PayCurrency })
  @IsEnum(PayCurrency)
  currency: PayCurrency;

  @ApiPropertyOptional({ example: 'UTR 412345678901' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  paymentMethodId?: string;
}

export class ListPayoutsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
