import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/roles.enum.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AgreementsService } from './agreements.service.js';
import { PublishAgreementDto, SignAgreementDto } from './dto/agreement.dto.js';

type AuthenticatedUser = { id: string };

@ApiTags('Agreements')
@ApiBearerAuth()
@Controller('agreements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgreementsController {
  constructor(private readonly agreements: AgreementsService) {}

  @Get('current')
  @ApiOperation({ summary: 'The current trainer agreement' })
  current() {
    return this.agreements.current();
  }

  @Get('me')
  @ApiOperation({ summary: 'My agreement status and signing history' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.agreements.mine(user.id);
  }

  @Post('me/sign')
  @ApiOperation({ summary: 'Sign (or re-sign) the current agreement' })
  async sign(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SignAgreementDto,
    @Req() req: Request,
  ) {
    await this.agreements.sign(
      user.id,
      dto.signature,
      req.headers['user-agent'],
      req.ip,
    );
    return this.agreements.mine(user.id);
  }

  @Get('me/signatures/:id')
  @ApiOperation({ summary: 'A signed copy of the agreement I signed' })
  mySignedCopy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.agreements.signedCopy(id, user.id);
  }

  @Get('admin/versions')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'All agreement versions with signature counts' })
  versions() {
    return this.agreements.versions();
  }

  @Post('admin/versions')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Publish an edited agreement as a new version' })
  async publish(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PublishAgreementDto,
  ) {
    const data = await this.agreements.publish(user.id, dto);
    return {
      success: true,
      message: dto.requireResign
        ? `Published ${data.version}. Candidates will be asked to re-sign.`
        : `Published ${data.version}.`,
      data,
    };
  }

  @Get('admin/signatures/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Any candidate's signed copy" })
  signedCopy(@Param('id', ParseUUIDPipe) id: string) {
    return this.agreements.signedCopy(id);
  }
}
