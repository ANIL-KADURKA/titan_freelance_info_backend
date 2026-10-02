import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class SignAgreementDto {
  @ApiProperty({
    example: 'UshaSri Gudikandula',
    description: 'Typed legal name used as the digital signature',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  signature: string;
}

export class PublishAgreementDto {
  @ApiProperty({ example: 'Titan Trainer Agreement' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description:
      'Agreement text. "## " starts a section heading, "- " a bullet point.',
  })
  @Transform(trim)
  @IsString()
  @MinLength(20)
  @MaxLength(50000)
  body: string;

  @ApiPropertyOptional({ example: 'Clarified payout timelines' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  changeNote?: string;

  @ApiProperty({
    description:
      'true publishes a new major version that every candidate must re-sign; false is a minor wording update.',
  })
  @IsBoolean()
  requireResign: boolean;
}
