import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = Date.now();
    const method = req.method;
    const url = req.originalUrl || req.url;
    const userId = (req as Request & { user?: { id?: string } }).user?.id;

    this.logger.log(
      `Incoming ${method} ${url}${userId ? ` | userId=${userId}` : ''}`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          this.logger.log(
            `Completed ${method} ${url} | status=${res.statusCode} | duration=${duration}ms${
              userId ? ` | userId=${userId}` : ''
            }`,
          );
        },
        error: (error) => {
          const duration = Date.now() - start;
          this.logger.error(
            `Failed ${method} ${url} | status=${res.statusCode ?? 'unknown'} | duration=${duration}ms${
              userId ? ` | userId=${userId}` : ''
            } | error=${error?.message ?? String(error)}`,
            error?.stack,
          );
        },
      }),
    );
  }
}
