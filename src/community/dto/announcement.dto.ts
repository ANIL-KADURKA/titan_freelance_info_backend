import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  AnnouncementCategory,
  AnnouncementStatus,
  ReactionType,
} from '@prisma/client';
import { PaginationQueryDto } from '../../common/pagination.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateAnnouncementDto {
  @ApiProperty({ example: 'Diwali payouts schedule' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'Payouts for this week will be sent on Friday.' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(5000)
  body: string;

  @ApiProperty({ enum: AnnouncementStatus })
  @IsEnum(AnnouncementStatus)
  status: AnnouncementStatus;

  @ApiPropertyOptional({ enum: AnnouncementCategory, default: 'GENERAL' })
  @IsOptional()
  @IsEnum(AnnouncementCategory)
  category?: AnnouncementCategory;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @ApiPropertyOptional({
    description: 'ISO date-time; null or omitted = never expires.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsDateString()
  expiresAt?: string | null;
}

export class UpdateAnnouncementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(5000)
  body?: string;

  @ApiPropertyOptional({ enum: AnnouncementStatus })
  @IsOptional()
  @IsEnum(AnnouncementStatus)
  status?: AnnouncementStatus;

  @ApiPropertyOptional({ enum: AnnouncementCategory })
  @IsOptional()
  @IsEnum(AnnouncementCategory)
  category?: AnnouncementCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @ApiPropertyOptional({ description: 'null = never expires', nullable: true })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsDateString()
  expiresAt?: string | null;
}

export const announcementStates = ['live', 'draft', 'expired', 'all'] as const;
export type AnnouncementState = (typeof announcementStates)[number];

export class ListAnnouncementsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: announcementStates, default: 'all' })
  @IsOptional()
  @IsIn(announcementStates)
  state?: AnnouncementState;
}

export class PinAnnouncementDto {
  @ApiProperty()
  @IsBoolean()
  pinned: boolean;
}

export class ReactToAnnouncementDto {
  @ApiProperty({ enum: ReactionType })
  @IsEnum(ReactionType)
  type: ReactionType;
}
