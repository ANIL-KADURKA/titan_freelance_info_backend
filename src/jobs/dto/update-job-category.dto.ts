import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateJobCategoryDto {
  @ApiPropertyOptional({ example: 'Design', description: 'Job category name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'design',
    description: 'Unique job category slug',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    example: 'Creative, visual, and UX work',
    description: 'Description for this category',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether the category remains active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 2,
    description: 'Sort order for the category',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
