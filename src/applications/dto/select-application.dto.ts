import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Work account + instructions emailed to a selected candidate. */
export class SelectApplicationDto {
  @ApiProperty({ example: 'trainer.042@client-platform.com' })
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  workEmail: string;

  @ApiProperty({
    description: 'Emailed to the candidate only — never stored.',
    example: 'Temp#2026',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  workPassword: string;

  @ApiPropertyOptional({
    description: 'One instruction per line; shown as a numbered list.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  workInstructions?: string;

  @ApiPropertyOptional({ description: 'Internal note for the history.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
