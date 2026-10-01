import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { TimesheetStatus } from '@prisma/client';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Create or replace the entry for one day (one per project per day). */
export class SaveTimesheetEntryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  applicationId: string;

  @ApiProperty({ example: '2026-10-01' })
  @Matches(DATE, { message: 'workDate must be YYYY-MM-DD' })
  workDate: string;

  @ApiProperty({
    example: 6.5,
    description: 'Hours, days or tasks per the job unit.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  quantity: number;

  @ApiProperty({
    example: 'Ranked 40 Hindi conversations, rewrote 12 answers.',
  })
  @Transform(trim)
  @IsString()
  @MinLength(5, {
    message: 'Describe the work you did (at least 5 characters).',
  })
  @MaxLength(2000)
  note: string;
}

export class ListMyTimesheetsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @Matches(DATE)
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @Matches(DATE)
  to?: string;
}

export class ListTimesheetsQueryDto extends ListMyTimesheetsQueryDto {
  @ApiPropertyOptional({ enum: TimesheetStatus })
  @IsOptional()
  @IsIn(Object.values(TimesheetStatus))
  status?: TimesheetStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  jobId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class ReviewTimesheetsDto {
  @ApiProperty({ type: [String] })
  @IsUUID('all', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  ids: string[];

  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsIn(['APPROVED', 'REJECTED'])
  decision: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ description: 'Required when rejecting.' })
  @ValidateIf((dto: ReviewTimesheetsDto) => dto.decision === 'REJECTED')
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Add a reason so the candidate can fix it.' })
  @MaxLength(500)
  reason?: string;
}
