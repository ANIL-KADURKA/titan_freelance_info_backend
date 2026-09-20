import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UpdateCredentialsDto {
  @ApiProperty({
    example: 'john.doe@company.com',
    description: 'Updated professional email address',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'SecurePass123!',
    minLength: 8,
    description: 'Updated password',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
