import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  Max,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateDocumentTypeDto {
  @ApiProperty({ example: 'resume' })
  @IsString()
  key: string;

  @ApiProperty({ example: 'Resume' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String], example: ['application/pdf'] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  allowedMimeTypes?: string[];

  @ApiPropertyOptional({ example: 10485760 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  maxSizeBytes?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  sensitive?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowCandidateReuse?: boolean;
}
