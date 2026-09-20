import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto.js';
import { CreateEducationDto, UpdateEducationDto } from './dto/education.dto.js';
import {
  CreateSocialLinkDto,
  UpdateSocialLinkDto,
} from './dto/social-link.dto.js';
import {
  CreateProfessionalInfoDto,
  UpdateProfessionalInfoDto,
} from './dto/professional-info.dto.js';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get the current user profile with related details',
  })
  getProfile(@CurrentUser() user: { id: string }) {
    return this.userService.getProfile(user.id);
  }

  @Get('addresses')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List user addresses' })
  listAddresses(@CurrentUser() user: { id: string }) {
    return this.userService.listAddresses(user.id);
  }

  @Post('addresses')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a user address' })
  createAddress(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateAddressDto,
  ) {
    return this.userService.createOrUpdateAddress(user.id, dto);
  }

  @Patch('addresses/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a user address' })
  updateAddress(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.userService.createOrUpdateAddress(user.id, {
      addressType: dto.addressType ?? 'CURRENT',
      addressLine: dto.addressLine,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      postalCode: dto.postalCode,
      isPrimary: dto.isPrimary,
      id,
    } as UpdateAddressDto & { id: string });
  }

  @Delete('addresses/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a user address' })
  deleteAddress(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.userService.deleteAddress(user.id, id);
  }

  @Get('education')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List user education records' })
  listEducation(@CurrentUser() user: { id: string }) {
    return this.userService.listEducation(user.id);
  }

  @Post('education')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a user education record' })
  createEducation(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateEducationDto,
  ) {
    return this.userService.createEducation(user.id, dto);
  }

  @Patch('education/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a user education record' })
  updateEducation(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateEducationDto,
  ) {
    return this.userService.updateEducation(user.id, id, dto);
  }

  @Delete('education/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a user education record' })
  deleteEducation(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.userService.deleteEducation(user.id, id);
  }

  @Get('social-links')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List user social media links' })
  listSocialLinks(@CurrentUser() user: { id: string }) {
    return this.userService.listSocialLinks(user.id);
  }

  @Post('social-links')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a user social media link' })
  createSocialLink(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateSocialLinkDto,
  ) {
    return this.userService.createSocialLink(user.id, dto);
  }

  @Patch('social-links/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a user social media link' })
  updateSocialLink(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateSocialLinkDto,
  ) {
    return this.userService.updateSocialLink(user.id, id, dto);
  }

  @Delete('social-links/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a user social media link' })
  deleteSocialLink(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.userService.deleteSocialLink(user.id, id);
  }

  @Get('professional-info')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current user professional information' })
  getProfessionalInfo(@CurrentUser() user: { id: string }) {
    return this.userService.getProfessionalInfo(user.id);
  }

  @Post('professional-info')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or upsert professional information' })
  upsertProfessionalInfo(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateProfessionalInfoDto,
  ) {
    return this.userService.upsertProfessionalInfo(user.id, dto);
  }

  @Patch('professional-info')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update professional information' })
  updateProfessionalInfo(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProfessionalInfoDto,
  ) {
    return this.userService.upsertProfessionalInfo(user.id, dto);
  }
}
