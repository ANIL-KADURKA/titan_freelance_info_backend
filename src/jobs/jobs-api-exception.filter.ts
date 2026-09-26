import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class JobsApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<{
      status: (statusCode: number) => { json: (body: unknown) => void };
    }>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const responseObject =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as Record<string, unknown>)
        : undefined;
    const rawMessage = responseObject?.message;
    const errors = Array.isArray(rawMessage) ? rawMessage : undefined;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join(' ')
      : typeof rawMessage === 'string'
        ? rawMessage
        : typeof exceptionResponse === 'string'
          ? exceptionResponse
          : exception instanceof HttpException
            ? exception.message
            : 'An unexpected error occurred.';

    response.status(statusCode).json({
      success: false,
      message,
      statusCode,
      ...(typeof responseObject?.code === 'string'
        ? { code: responseObject.code }
        : {}),
      ...(errors ? { errors } : {}),
    });
  }
}
