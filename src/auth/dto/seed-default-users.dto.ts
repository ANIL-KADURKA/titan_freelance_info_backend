import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class SeedDefaultUsersDto {
  @ApiPropertyOptional({
    example: 'admin@titan.local',
    description: 'Admin email to create if missing',
  })
  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  @ApiPropertyOptional({
    example: 'Admin@123',
    description: 'Admin password to create if missing',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  adminPassword?: string;

  @ApiPropertyOptional({
    example: 'recruiter@titan.local',
    description: 'Recruiter email to create if missing',
  })
  @IsOptional()
  @IsEmail()
  recruiterEmail?: string;

  @ApiPropertyOptional({
    example: 'Recruiter@123',
    description: 'Recruiter password to create if missing',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  recruiterPassword?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'Set to true to recreate existing seeded users with the provided values',
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
