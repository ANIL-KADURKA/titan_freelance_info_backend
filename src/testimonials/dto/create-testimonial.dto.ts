import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublishStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateTestimonialDto {
  @ApiProperty({ example: 'Aisha Khan', description: 'Author name' })
  @IsString()
  @IsNotEmpty()
  authorName: string;

  @ApiPropertyOptional({ example: 'Senior Product Designer' })
  @IsOptional()
  @IsString()
  authorRole?: string;

  @ApiProperty({ example: 'The team was proactive and highly professional.' })
  @IsString()
  @IsNotEmpty()
  quote: string;

  @ApiPropertyOptional({ example: '2024-01-15', description: 'Joined date' })
  @IsOptional()
  @IsDateString()
  joinedAt?: string;

  @ApiPropertyOptional({
    enum: PublishStatus,
    example: PublishStatus.DRAFT,
    description: 'Publication status',
    default: PublishStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus = PublishStatus.DRAFT;

  @ApiPropertyOptional({ example: 0, description: 'Sorting order' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
