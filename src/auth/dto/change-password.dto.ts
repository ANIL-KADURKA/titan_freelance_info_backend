import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPass123!', description: 'Current password' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({
    example: 'NewStrongPass123!',
    minLength: 8,
    description: 'New password to set',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
