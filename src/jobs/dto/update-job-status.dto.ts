import { ApiProperty } from '@nestjs/swagger';
import { JobStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateJobStatusDto {
  @ApiProperty({
    enum: JobStatus,
    example: JobStatus.PUBLISHED,
    description: 'New job status',
  })
  @IsEnum(JobStatus)
  status: JobStatus;
}
