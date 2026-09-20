import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateEducationDto {
  @ApiProperty({
    example: 'Harvard University',
    description: 'Institution attended',
  })
  @IsString()
  institution: string;

  @ApiPropertyOptional({ example: 'BSc', description: 'Degree earned' })
  @IsOptional()
  @IsString()
  degree?: string;

  @ApiPropertyOptional({
    example: 'Computer Science',
    description: 'Field of study',
  })
  @IsOptional()
  @IsString()
  fieldOfStudy?: string;

  @ApiPropertyOptional({ example: '2020-09-01', description: 'Start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-06-30', description: 'End date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'A', description: 'Grade or score' })
  @IsOptional()
  @IsString()
  grade?: string;
}

export class UpdateEducationDto extends CreateEducationDto {}
