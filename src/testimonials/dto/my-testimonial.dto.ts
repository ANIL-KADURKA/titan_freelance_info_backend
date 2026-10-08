import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Candidate submission (multipart; `photo` required the first time). */
export class SubmitTestimonialDto {
  @ApiProperty({ example: 'Titan paid me on time, every week.' })
  @Transform(trim)
  @IsString()
  @MinLength(20)
  @MaxLength(600)
  quote: string;

  @ApiPropertyOptional({ example: 'AI Trainer · Telugu' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  authorRole?: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({
    description: 'Consent to show this on the Titan website ("true").',
  })
  @Transform(({ value }) => value === true || value === 'true')
  @Equals(true)
  consent: boolean;
}

export class RejectTestimonialDto {
  @ApiProperty({ example: 'Please remove the client name.' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class ListTestimonialsQueryDto {
  @ApiPropertyOptional({
    enum: ['pending', 'live', 'rejected', 'withdrawn', 'all'],
  })
  @IsOptional()
  @IsIn(['pending', 'live', 'rejected', 'withdrawn', 'all'])
  tab?: 'pending' | 'live' | 'rejected' | 'withdrawn' | 'all';
}
