import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

/** Send either an ID token (`credential`) or an OAuth `accessToken`. */
export class GoogleLoginDto {
  @ApiPropertyOptional({
    description: 'ID token ("credential") from Google Identity Services',
  })
  @ValidateIf((dto: GoogleLoginDto) => !dto.accessToken)
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  credential?: string;

  @ApiPropertyOptional({
    description: "Access token from Google's token client (our own button)",
  })
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  accessToken?: string;
}
