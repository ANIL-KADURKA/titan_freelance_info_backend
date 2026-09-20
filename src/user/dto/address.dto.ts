import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export enum AddressTypeDto {
  CURRENT = 'CURRENT',
  PERMANENT = 'PERMANENT',
  OTHER = 'OTHER',
}

export class CreateAddressDto {
  @ApiProperty({
    enum: AddressTypeDto,
    example: AddressTypeDto.CURRENT,
    required: false,
    default: AddressTypeDto.CURRENT,
  })
  @IsEnum(AddressTypeDto)
  @IsOptional()
  addressType?: AddressTypeDto = AddressTypeDto.CURRENT;

  @ApiPropertyOptional({
    example: '123 Main Street',
    description: 'Street address',
  })
  @IsOptional()
  @IsString()
  addressLine?: string;

  @ApiPropertyOptional({ example: 'New York', description: 'City' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'NY', description: 'State or region' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 'USA', description: 'Country' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: '10001', description: 'Postal code' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether this is the primary address',
  })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean = false;
}

export class UpdateAddressDto extends CreateAddressDto {
  @ApiPropertyOptional({ example: 'addr_123', description: 'Address ID' })
  @IsOptional()
  @IsString()
  id?: string;
}
