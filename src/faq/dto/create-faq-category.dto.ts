import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublishStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateFaqCategoryDto {
  @ApiProperty({ example: 'General', description: 'FAQ category name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: 'Questions related to onboarding and account setup',
    description: 'Optional category description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Display order for the category',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    enum: PublishStatus,
    example: PublishStatus.DRAFT,
    description: 'Publication status',
    default: PublishStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus = PublishStatus.DRAFT;
}
