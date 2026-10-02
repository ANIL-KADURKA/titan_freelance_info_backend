import { Module } from '@nestjs/common';
import { AgreementsModule } from '../agreements/agreements.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { OnboardingController } from './onboarding.controller.js';
import { OnboardingService } from './onboarding.service.js';

@Module({
  imports: [AuthModule, AgreementsModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
