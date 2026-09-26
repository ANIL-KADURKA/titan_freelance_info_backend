import {
  CallHandler,
  ExecutionContext,
  HttpException,
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
    const url = (req.originalUrl || req.url).split('?')[0];
    const userId = (req as Request & { user?: { id?: string } }).user?.id;
    const requestId = String(res.getHeader('x-request-id') ?? 'unknown');

    return next.handle().pipe(
      tap({
        error: (error) => {
          const duration = Date.now() - start;
          const status =
            error instanceof HttpException
              ? error.getStatus()
              : res.statusCode >= 400
                ? res.statusCode
                : 'unknown';
          const exceptionResponse =
            error instanceof HttpException ? error.getResponse() : undefined;
          const responseMessage =
            typeof exceptionResponse === 'object' && exceptionResponse !== null
              ? (exceptionResponse as { message?: unknown }).message
              : undefined;
          const errorMessage = Array.isArray(responseMessage)
            ? responseMessage.join('; ')
            : typeof responseMessage === 'string'
              ? responseMessage
              : (error?.message ?? String(error));
          const logMessage = `${
            typeof status === 'number' && status < 500
              ? 'Request rejected'
              : 'Handler failed'
          } | requestId=${requestId} | ${method} ${url} | status=${status} | duration=${duration}ms${
            userId ? ` | userId=${userId}` : ''
          } | error=${errorMessage}`;

          if (typeof status === 'number' && status < 500) {
            this.logger.warn(logMessage);
          } else {
            this.logger.error(logMessage, error?.stack);
          }
        },
      }),
    );
  }
}
