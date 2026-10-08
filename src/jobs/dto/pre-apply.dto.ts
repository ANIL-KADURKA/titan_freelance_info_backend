import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PreApplyDto {
  @ApiPropertyOptional({
    example: 'Hyderabad, Telangana',
    description: 'Where the candidate can work from',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(160)
  location?: string;
}
