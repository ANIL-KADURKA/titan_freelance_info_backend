import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/roles.enum.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { UploadedDocument } from '../common/document-validation.service.js';
import { CreatePayoutDto, ListPayoutsQueryDto } from './dto/payout.dto.js';
import { PayoutsService } from './payouts.service.js';

type AuthenticatedUser = { id: string };

@ApiTags('Payouts')
@ApiBearerAuth()
@Controller('payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get('pending')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Amounts owed per candidate and currency' })
  pending() {
    return this.payouts.pending();
  }

  @Get('me')
  @Roles(UserRole.CANDIDATE)
  @ApiOperation({ summary: 'My payout history' })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.payouts.listMine(user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Payout history' })
  listAll(@Query() query: ListPayoutsQueryDto) {
    return this.payouts.listAll(query.userId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Mark a candidate as paid with a payment screenshot (proof)',
  })
  @UseInterceptors(
    FileInterceptor('proof', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePayoutDto,
    @UploadedFile() proof?: UploadedDocument,
  ) {
    const data = await this.payouts.create(user.id, dto, proof);
    return { success: true, message: 'Marked as paid.', data };
  }

  @Get(':id/proof-url')
  @Roles(UserRole.CANDIDATE, UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Signed link to the payment proof' })
  proofUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payouts.proofUrl(id, user.id);
  }
}
