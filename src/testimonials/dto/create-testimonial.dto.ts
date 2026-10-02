import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestimonialStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Multipart sends "" for an empty field; treat it as "not provided". */
const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' || value === 'null' ? undefined : value;

/** Admin-added testimonial (multipart with a required `photo`). */
export class CreateTestimonialDto {
  @ApiProperty({ example: 'Aisha Khan', description: 'Author name' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  authorName: string;

  @ApiPropertyOptional({ example: 'Senior Product Designer' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  authorRole?: string;

  @ApiProperty({ example: 'The team was proactive and highly professional.' })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  quote: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ example: '2024-01-15', description: 'Joined date' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  joinedAt?: string;

  @ApiPropertyOptional({
    enum: [TestimonialStatus.APPROVED, TestimonialStatus.PENDING],
    default: TestimonialStatus.APPROVED,
    description: 'APPROVED shows it on the website right away.',
  })
  @IsOptional()
  @IsIn([TestimonialStatus.APPROVED, TestimonialStatus.PENDING])
  status?: TestimonialStatus;

  @ApiPropertyOptional({ example: 0, description: 'Sorting order' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
