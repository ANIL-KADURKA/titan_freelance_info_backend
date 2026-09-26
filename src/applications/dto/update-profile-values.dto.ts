import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import { parseJsonField } from './parse-json-field.js';

export class UpdateProfileValuesDto {
  @ApiProperty({
    description:
      'Reusable profile values keyed by canonical profile field key.',
    example: { years_experience: 5 },
  })
  @Transform(({ value }: { value: unknown }) => parseJsonField(value))
  @IsObject()
  values: Record<string, unknown>;
}
