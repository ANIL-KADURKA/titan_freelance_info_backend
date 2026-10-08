import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.js';

export class NotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '"true" for unread only' })
  @IsOptional()
  @IsIn(['true', 'false'])
  unread?: 'true' | 'false';
}
