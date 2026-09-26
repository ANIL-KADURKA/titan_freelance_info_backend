import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { parseJsonField } from './parse-json-field.js';

export class UpdateApplicationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverNote?: string;

  @ApiPropertyOptional({
    description:
      'Partial object of application field values keyed by field key.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseJsonField(value))
  @IsObject()
  values?: Record<string, unknown>;
}
