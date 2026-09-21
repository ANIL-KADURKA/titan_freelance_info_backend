import { ApiPropertyOptional } from '@nestjs/swagger';
import { EligibilityFieldType, EligibilityOperator } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateJobEligibilityRuleDto {
  @ApiPropertyOptional({
    example: 'experience_years',
    description: 'Eligibility field key',
  })
  @IsOptional()
  @IsString()
  fieldKey?: string;

  @ApiPropertyOptional({
    enum: EligibilityFieldType,
    example: EligibilityFieldType.NUMBER,
    description: 'Eligibility field type',
  })
  @IsOptional()
  @IsEnum(EligibilityFieldType)
  fieldType?: EligibilityFieldType;

  @ApiPropertyOptional({
    enum: EligibilityOperator,
    example: EligibilityOperator.GTE,
    description: 'Eligibility comparison operator',
  })
  @IsOptional()
  @IsEnum(EligibilityOperator)
  operator?: EligibilityOperator;

  @ApiPropertyOptional({
    example: 2,
    description: 'Expected value for the rule',
  })
  @IsOptional()
  value?: unknown;

  @ApiPropertyOptional({ example: 1, description: 'Updated display order' })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
