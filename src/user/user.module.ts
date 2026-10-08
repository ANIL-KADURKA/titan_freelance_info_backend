import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module.js';
import { UserAccountService } from './user-account.service.js';
import { UserService } from './user.service.js';
import { UserController } from './user.controller.js';

@Module({
  imports: [CommonModule],
  controllers: [UserController],
  providers: [UserService, UserAccountService],
  exports: [UserService],
})
export class UserModule {}
