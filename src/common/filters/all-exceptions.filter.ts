import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: any[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;
      
      // If it's a ValidationPipe error, res.message is an array of errors
      if (status === HttpStatus.BAD_REQUEST && Array.isArray(res.message)) {
        code = 'VALIDATION_FAILED';
        message = 'Input validation failed on one or more fields.';
        details = res.message;
      } else {
        code = res.code || (status === HttpStatus.BAD_REQUEST ? 'VALIDATION_FAILED' : 'HTTP_EXCEPTION');
        message = res.message || exception.message;
        details = res.details || [];
      }
    } else if (exception && typeof exception === 'object' && exception.constructor.name === 'PrismaClientKnownRequestError') {
      const prismaError = exception as any;
      if (prismaError.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'RESOURCE_ALREADY_EXISTS';
        message = 'Unique constraint violation';
      } else if (prismaError.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'RESOURCE_NOT_FOUND';
        message = 'Requested record does not exist';
      }
    }

    this.logger.error(
      `[${request.method}] ${request.url} - Status: ${status} - Code: ${code} - Msg: ${message}`,
      exception instanceof Error ? exception.stack : '',
    );

    response.status(status).json({
      success: false,
      error: { code, message, details },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
