import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

// Only failures are logged: no per-query or connection chatter.
type PrismaLoggingOptions = {
  log: [{ emit: 'event'; level: 'error' }];
} & Prisma.PrismaClientOptions;

const describe = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

@Injectable()
export class PrismaService
  extends PrismaClient<PrismaLoggingOptions>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [{ emit: 'event', level: 'error' }],
    });

    this.$on('error', (event) => {
      this.logger.error(
        `Database error | target=${event.target} | ${event.message}`,
      );
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      this.logger.error(
        `Database connection failed: ${describe(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch (error) {
      this.logger.error(
        `Database disconnect failed: ${describe(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
