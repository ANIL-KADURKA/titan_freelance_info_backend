import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/roles.enum.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { DashboardService } from './dashboard.service.js';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('me')
  @Roles(UserRole.CANDIDATE)
  @ApiOperation({ summary: 'Candidate home: money, projects, activity' })
  candidate(@CurrentUser() user: { id: string }) {
    return this.dashboard.candidate(user.id);
  }

  @Get('admin')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER)
  @ApiOperation({ summary: 'Admin dashboard: metrics, queues, money' })
  admin() {
    return this.dashboard.admin();
  }
}
