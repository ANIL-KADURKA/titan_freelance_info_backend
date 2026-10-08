import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import {
  SaveOnboardingProfileDto,
  SendPhoneOtpDto,
  SignAgreementDto,
  VerifyFirebasePhoneDto,
  VerifyPhoneOtpDto,
} from './dto/onboarding.dto.js';
import { OnboardingService } from './onboarding.service.js';

type AuthenticatedUser = { id: string };

@ApiTags('Onboarding')
@ApiBearerAuth()
@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get()
  @ApiOperation({ summary: 'Get onboarding progress and the next step' })
  getState(@CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.getState(user.id);
  }

  @Post('phone/otp')
  @ApiOperation({ summary: 'Send (or resend) the mobile verification code' })
  sendPhoneOtp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendPhoneOtpDto,
  ) {
    return this.onboardingService.sendPhoneOtp(user.id, dto.phone);
  }

  @Post('phone/verify')
  @ApiOperation({ summary: 'Verify the mobile number with the code' })
  verifyPhoneOtp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyPhoneOtpDto,
  ) {
    return this.onboardingService.verifyPhoneOtp(user.id, dto.otp);
  }

  @Post('phone/firebase')
  @ApiOperation({
    summary: 'Verify the mobile number with a Firebase phone sign-in token',
  })
  verifyFirebasePhone(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyFirebasePhoneDto,
  ) {
    return this.onboardingService.verifyFirebasePhone(user.id, dto.idToken);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Save legal name, location and work languages' })
  saveProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveOnboardingProfileDto,
  ) {
    return this.onboardingService.saveProfile(user.id, dto);
  }

  @Post('agreement')
  @ApiOperation({ summary: 'Sign the trainer agreement and finish onboarding' })
  signAgreement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SignAgreementDto,
    @Req() req: Request,
  ) {
    return this.onboardingService.signAgreement(
      user.id,
      dto.signature,
      req.headers['user-agent'],
      req.ip,
    );
  }
}
