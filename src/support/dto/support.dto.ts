import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
/** Multipart sends "" for empty fields. */
const blank = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

/** New ticket (multipart; optional `attachment`). */
export class CreateTicketDto {
  @ApiProperty({ enum: SupportTicketCategory })
  @IsEnum(SupportTicketCategory)
  category: SupportTicketCategory;

  @ApiPropertyOptional({ enum: SupportTicketPriority })
  @IsOptional()
  @Transform(blank)
  @IsEnum(SupportTicketPriority)
  priority?: SupportTicketPriority;

  @ApiProperty({ example: 'Payout for September not received' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  subject: string;

  @ApiProperty({ description: 'What is going on (the first message)' })
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description: string;
}

/** A reply (multipart; optional `attachment`). */
export class ReplyDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;

  @ApiPropertyOptional({
    enum: SupportTicketStatus,
    description: 'Admins only: status to set with this reply',
  })
  @IsOptional()
  @Transform(blank)
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;
}

export class UpdateTicketDto {
  @ApiPropertyOptional({ enum: SupportTicketStatus })
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @ApiPropertyOptional({ enum: SupportTicketPriority })
  @IsOptional()
  @IsEnum(SupportTicketPriority)
  priority?: SupportTicketPriority;

  @ApiPropertyOptional({ description: 'Admin to assign; null unassigns' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  @IsUUID()
  assignedToId?: string | null;
}

export class ListTicketsQueryDto {
  @ApiPropertyOptional({ enum: SupportTicketStatus })
  @IsOptional()
  @Transform(blank)
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @ApiPropertyOptional({ description: 'Ticket number, subject or requester' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
