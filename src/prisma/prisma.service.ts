import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

type PrismaLoggingOptions = {
  log: [
    { emit: 'event'; level: 'query' },
    { emit: 'event'; level: 'warn' },
    { emit: 'event'; level: 'error' },
  ];
} & Prisma.PrismaClientOptions;

@Injectable()
export class PrismaService
  extends PrismaClient<PrismaLoggingOptions>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });

    this.$on('query', (event) => {
      this.logger.log(
        `Query completed | duration=${event.duration}ms | target=${event.target} | sql=${event.query}`,
      );
    });

    this.$on('warn', (event) => {
      this.logger.warn(event.message);
    });

    this.$on('error', (event) => {
      this.logger.error(event.message);
    });
  }

  async onModuleInit() {
    this.logger.log('Connecting to database');
    try {
      await this.$connect();
      this.logger.log('Database connection established');
    } catch (error) {
      this.logger.error(
        `Database connection failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database');
    try {
      await this.$disconnect();
      this.logger.log('Database connection closed');
    } catch (error) {
      this.logger.error(
        `Database disconnect failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
