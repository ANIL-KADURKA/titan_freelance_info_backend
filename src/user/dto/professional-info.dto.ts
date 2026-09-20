import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateProfessionalInfoDto {
  @ApiProperty({
    example: ['English', 'Spanish'],
    description: 'Spoken languages',
  })
  @IsArray()
  @IsString({ each: true })
  languages: string[];

  @ApiProperty({
    example: ['Node.js', 'TypeScript', 'PostgreSQL'],
    description: 'Hard skills',
  })
  @IsArray()
  @IsString({ each: true })
  hardSkills: string[];

  @ApiProperty({
    example: ['Communication', 'Leadership'],
    description: 'Soft skills',
  })
  @IsArray()
  @IsString({ each: true })
  softSkills: string[];

  @ApiPropertyOptional({
    example: 'Senior Backend Engineer',
    description: 'Current occupation',
  })
  @IsOptional()
  @IsString()
  currentOccupation?: string;
}

export class UpdateProfessionalInfoDto extends CreateProfessionalInfoDto {}
