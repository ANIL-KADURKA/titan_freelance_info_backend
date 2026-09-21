import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EligibilityFieldType, EligibilityOperator } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateJobEligibilityRuleDto {
  @ApiProperty({
    example: 'experience_years',
    description: 'Eligibility field key used by the rule',
  })
  @IsString()
  @IsNotEmpty()
  fieldKey: string;

  @ApiProperty({
    enum: EligibilityFieldType,
    example: EligibilityFieldType.NUMBER,
    description: 'Credential type checked by this eligibility rule',
  })
  @IsEnum(EligibilityFieldType)
  fieldType: EligibilityFieldType;

  @ApiProperty({
    enum: EligibilityOperator,
    example: EligibilityOperator.GTE,
    description: 'Comparison operator for the rule',
  })
  @IsEnum(EligibilityOperator)
  operator: EligibilityOperator;

  @ApiProperty({ example: 2, description: 'The expected value for the rule' })
  @IsNotEmpty()
  value: unknown;

  @ApiPropertyOptional({
    example: 1,
    description: 'Order in which this rule should render',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
