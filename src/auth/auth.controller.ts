import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RequestOtpDto } from './dto/request-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { CurrentUser } from './current-user.decorator.js';
import { UpdateCredentialsDto } from './dto/update-credentials.dto.js';
import { TestEmailDto } from './dto/test-email.dto.js';
import { SeedDefaultUsersDto } from './dto/seed-default-users.dto.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User created' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/password or OTP' })
  @ApiResponse({ status: 200, description: 'Authentication successful' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.headers['user-agent'], req.ip);
  }

  @Post('otp/request')
  @ApiOperation({
    summary: 'Request an OTP for login, verification, or password reset',
  })
  @ApiResponse({ status: 200, description: 'OTP sent' })
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify an OTP' })
  @ApiResponse({ status: 200, description: 'OTP verified' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using OTP verification' })
  @ApiResponse({ status: 200, description: 'Password updated' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  getCurrentUser(@CurrentUser() user: { id: string; email: string }) {
    return this.authService.getCurrentUser(user.id);
  }

  @Post('update-professional-email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update professional email and password' })
  async updateProfessionalEmail(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateCredentialsDto,
  ) {
    return this.authService.updateProfessionalCredentials(user.id, dto);
  }

  @Post('seed-default-users')
  @ApiOperation({
    summary: 'Create the default admin and recruiter users if absent',
  })
  @ApiResponse({ status: 200, description: 'Seed users ensured successfully' })
  async seedDefaultUsers(@Body() dto: SeedDefaultUsersDto) {
    return this.authService.seedDefaultUsers(dto);
  }

  @Post('test-email')
  @ApiOperation({ summary: 'Send a test email to verify SMTP configuration' })
  @ApiResponse({
    status: 200,
    description: 'Test email delivered successfully',
  })
  async sendTestEmail(@Body() dto: TestEmailDto) {
    return this.authService.sendTestEmail(dto);
  }
}
