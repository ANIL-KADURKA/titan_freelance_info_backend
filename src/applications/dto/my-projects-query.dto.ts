import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.js';

export const projectViews = ['applied', 'current', 'completed'] as const;
export type ProjectView = (typeof projectViews)[number];

export class MyProjectsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: projectViews, default: 'applied' })
  @IsOptional()
  @IsIn(projectViews)
  view?: ProjectView;
}
