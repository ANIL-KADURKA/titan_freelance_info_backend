import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { parseJsonField } from './parse-json-field.js';

export class CreateApplicationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  jobId: string;

  @ApiPropertyOptional({
    description:
      'JSON object with job application field keys as property names.',
    example: { portfolio_url: 'https://example.com' },
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseJsonField(value))
  @IsObject()
  values?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverNote?: string;

  @ApiPropertyOptional({
    description:
      'Map FILE application field keys to saved candidate profile document ids. Select saved files explicitly; sensitive documents are not suggested by prefill.',
    example: { resume: '8c6f0b27-992b-4f40-9f4d-6f63aeec9cd9' },
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseJsonField(value))
  @IsObject()
  savedDocuments?: Record<string, string>;

  @ApiPropertyOptional({
    description:
      'If true, save submitted non-sensitive mapped answers and reusable document types to the candidate profile.',
    default: false,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  rememberInProfile?: boolean;
}
