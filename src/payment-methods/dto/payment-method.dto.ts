import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PaymentMethodStatus, PaymentMethodType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreatePaymentMethodDto {
  @ApiProperty({ enum: PaymentMethodType, example: PaymentMethodType.UPI })
  @IsEnum(PaymentMethodType)
  type: PaymentMethodType;

  @ApiPropertyOptional({ example: 'name@okhdfcbank' })
  @ValidateIf((dto: CreatePaymentMethodDto) => dto.type === 'UPI')
  @Transform(trim)
  @IsString()
  @Matches(/^[\w.-]{2,256}@[a-zA-Z]{2,64}$/, {
    message: 'Enter a valid UPI ID, e.g. name@okhdfcbank',
  })
  upiId?: string;

  @ApiPropertyOptional({ example: 'Usha Sri Gudikandula' })
  @ValidateIf((dto: CreatePaymentMethodDto) => dto.type === 'BANK')
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  accountHolderName?: string;

  @ApiPropertyOptional({ example: '123456789012' })
  @ValidateIf((dto: CreatePaymentMethodDto) => dto.type === 'BANK')
  @Transform(trim)
  @Matches(/^\d{9,18}$/, { message: 'Account number must be 9–18 digits' })
  accountNumber?: string;

  @ApiPropertyOptional({ example: 'HDFC0001234' })
  @ValidateIf((dto: CreatePaymentMethodDto) => dto.type === 'BANK')
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'Enter a valid IFSC code' })
  ifsc?: string;
}

export class ListPaymentMethodsQueryDto {
  @ApiPropertyOptional({ enum: PaymentMethodStatus })
  @IsOptional()
  @IsEnum(PaymentMethodStatus)
  status?: PaymentMethodStatus;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class ReviewPaymentMethodDto {
  @ApiProperty({ enum: ['VERIFIED', 'REJECTED'] })
  @IsIn([PaymentMethodStatus.VERIFIED, PaymentMethodStatus.REJECTED])
  decision: 'VERIFIED' | 'REJECTED';

  @ApiPropertyOptional({
    example: 'Account holder name does not match your profile',
    description: 'Required when rejecting',
  })
  @ValidateIf((dto: ReviewPaymentMethodDto) => dto.decision === 'REJECTED')
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}
