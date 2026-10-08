import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/roles.enum.js';
import { RolesGuard } from '../auth/roles.guard.js';
import {
  CreatePaymentMethodDto,
  ListPaymentMethodsQueryDto,
  ReviewPaymentMethodDto,
} from './dto/payment-method.dto.js';
import { PaymentMethodsService } from './payment-methods.service.js';

type AuthenticatedUser = { id: string };

@ApiTags('Payment methods')
@ApiBearerAuth()
@Controller('payment-methods')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Get('me')
  @Roles(UserRole.CANDIDATE)
  @ApiOperation({ summary: 'List my payout methods (account numbers masked)' })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentMethodsService.listMine(user.id);
  }

  @Post()
  @Roles(UserRole.CANDIDATE)
  @ApiOperation({ summary: 'Add a UPI ID or bank account (pending review)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentMethodDto,
  ) {
    return this.paymentMethodsService.create(user.id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.CANDIDATE)
  @ApiOperation({ summary: 'Remove one of my payout methods' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentMethodsService.remove(user.id, id);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: list payout methods with full details' })
  listForAdmin(@Query() query: ListPaymentMethodsQueryDto) {
    return this.paymentMethodsService.listForAdmin(query);
  }

  @Patch(':id/review')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: approve or reject a payout method' })
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewPaymentMethodDto,
  ) {
    return this.paymentMethodsService.review(user.id, id, dto);
  }
}
