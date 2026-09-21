import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationFieldType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateJobApplicationFieldDto {
  @ApiPropertyOptional({
    example: 'portfolio_url',
    description: 'Updated field key',
  })
  @IsOptional()
  @IsString()
  fieldKey?: string;

  @ApiPropertyOptional({
    enum: ApplicationFieldType,
    example: ApplicationFieldType.URL,
    description: 'Updated field type',
  })
  @IsOptional()
  @IsEnum(ApplicationFieldType)
  fieldType?: ApplicationFieldType;

  @ApiPropertyOptional({
    example: 'Portfolio URL',
    description: 'Updated field label',
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({
    example: 'Share your work',
    description: 'Updated field description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether the field is required',
  })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ example: 2, description: 'Updated display order' })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({
    example: ['Option A', 'Option B'],
    description: 'Updated field options',
  })
  @IsOptional()
  options?:
    Record<string, unknown> | unknown[] | string[] | number[] | boolean[];
}
