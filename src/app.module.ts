import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AgreementsModule } from './agreements/agreements.module.js';
import { CommunityModule } from './community/community.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { TimesheetsModule } from './timesheets/timesheets.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ApplicationsModule } from './applications/applications.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CommonModule } from './common/common.module.js';
import { LoggingInterceptor } from './common/logging.interceptor.js';
import { FaqModule } from './faq/faq.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { TestimonialsModule } from './testimonials/testimonials.module.js';
import { UserModule } from './user/user.module.js';
import { WebsiteContentModule } from './website-content/website-content.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    PrismaModule,
    CommonModule,
    AuthModule,
    UserModule,
    FaqModule,
    JobsModule,
    OnboardingModule,
    PaymentMethodsModule,
    TestimonialsModule,
    WebsiteContentModule,
    ApplicationsModule,
    NotificationsModule,
    TimesheetsModule,
    DashboardModule,
    CommunityModule,
    AgreementsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
