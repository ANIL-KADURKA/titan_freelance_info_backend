import { ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus, WorkMode } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum JobSearchSort {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  RECENTLY_PUBLISHED = 'recentlyPublished',
  DEADLINE_SOON = 'deadlineSoon',
  DEADLINE_LATEST = 'deadlineLatest',
  TITLE_ASC = 'titleAsc',
  TITLE_DESC = 'titleDesc',
  OPENINGS_HIGH = 'openingsHigh',
}

export class SearchJobsDto {
  @ApiPropertyOptional({ example: 'frontend' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: 'software-development' })
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional({ enum: WorkMode })
  @IsOptional()
  @IsEnum(WorkMode)
  workMode?: WorkMode;

  @ApiPropertyOptional({ enum: JobStatus })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @ApiPropertyOptional({ example: 'Remote' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'Next.js,TypeScript' })
  @IsOptional()
  @IsString()
  skills?: string;

  @ApiPropertyOptional({ enum: JobSearchSort, default: JobSearchSort.NEWEST })
  @IsOptional()
  @IsEnum(JobSearchSort)
  sort?: JobSearchSort;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ example: '12' })
  @IsOptional()
  @IsString()
  pageSize?: string;
}
