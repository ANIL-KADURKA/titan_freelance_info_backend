import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationFieldType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateJobApplicationFieldDto {
  @ApiProperty({
    example: 'portfolio_url',
    description: 'Unique field key for the application form',
  })
  @IsString()
  fieldKey: string;

  @ApiProperty({
    enum: ApplicationFieldType,
    example: ApplicationFieldType.URL,
    description: 'Field type for the application input',
  })
  @IsEnum(ApplicationFieldType)
  fieldType: ApplicationFieldType;

  @ApiProperty({
    example: 'Portfolio URL',
    description: 'Human readable field label',
  })
  @IsString()
  label: string;

  @ApiPropertyOptional({
    example: 'Share a portfolio or sample work',
    description: 'Field description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the field is required',
  })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ example: 1, description: 'Display order' })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({
    example: ['Option A', 'Option B'],
    description: 'Options for select-like fields',
  })
  @IsOptional()
  options?:
    Record<string, unknown> | unknown[] | string[] | number[] | boolean[];
}
