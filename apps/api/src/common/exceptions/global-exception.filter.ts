import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ValidationError } from 'class-validator';
import { ErrorResponseDto } from './error-response.dto';
import { ERROR_CODES } from './error-codes';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.createErrorResponse(exception, request);
    
    // Log the error with appropriate level
    this.logError(exception, errorResponse, request);

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private createErrorResponse(
    exception: any,
    request: Request,
  ): ErrorResponseDto {
    const timestamp = new Date().toISOString();
    const path = request.url;
    const traceId = request.headers['x-trace-id'] as string;

    // Handle NestJS HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      return {
        statusCode: status,
        message: this.extractMessage(exceptionResponse),
        error: this.mapStatusCodeToErrorCode(status),
        timestamp,
        path,
        details: this.extractDetails(exceptionResponse),
        traceId,
      };
    }

    // Handle validation errors
    if (this.isValidationError(exception)) {
      return {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message: 'Validation failed',
        error: ERROR_CODES.VALIDATION_ERROR,
        timestamp,
        path,
        details: this.formatValidationErrors(exception.response?.message),
        traceId,
      };
    }

    // Handle database errors
    if (this.isDatabaseError(exception)) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Database operation failed',
        error: ERROR_CODES.DATABASE_QUERY_ERROR,
        timestamp,
        path,
        details: process.env.NODE_ENV === 'development' ? { originalError: exception.message } : undefined,
        traceId,
      };
    }

    // Handle generic errors
    const isProduction = process.env.NODE_ENV === 'production';
    
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: isProduction ? 'Internal server error' : exception.message || 'Unknown error',
      error: ERROR_CODES.INTERNAL_SERVER_ERROR,
      timestamp,
      path,
      details: isProduction ? undefined : { 
        stack: exception.stack,
        name: exception.name,
      },
      traceId,
    };
  }

  private extractMessage(exceptionResponse: any): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }
    
    if (exceptionResponse?.message) {
      if (Array.isArray(exceptionResponse.message)) {
        return exceptionResponse.message.join(', ');
      }
      return exceptionResponse.message;
    }
    
    return 'An error occurred';
  }

  private extractDetails(exceptionResponse: any): Record<string, any> | undefined {
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const { message, statusCode, error, ...details } = exceptionResponse;
      return Object.keys(details).length > 0 ? details : undefined;
    }
    return undefined;
  }

  private mapStatusCodeToErrorCode(statusCode: number): string {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return ERROR_CODES.INVALID_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ERROR_CODES.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ERROR_CODES.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ERROR_CODES.NOT_FOUND;
      case HttpStatus.METHOD_NOT_ALLOWED:
        return ERROR_CODES.METHOD_NOT_ALLOWED;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ERROR_CODES.VALIDATION_ERROR;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ERROR_CODES.RATE_LIMIT_EXCEEDED;
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return ERROR_CODES.INTERNAL_SERVER_ERROR;
      case HttpStatus.BAD_GATEWAY:
        return ERROR_CODES.EXTERNAL_SERVICE_ERROR;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return ERROR_CODES.SERVICE_UNAVAILABLE;
      default:
        return ERROR_CODES.INTERNAL_SERVER_ERROR;
    }
  }

  private isValidationError(exception: any): boolean {
    if (!(exception instanceof HttpException)) {
      return false;
    }
    
    if (exception.getStatus() !== HttpStatus.UNPROCESSABLE_ENTITY) {
      return false;
    }
    
    const response = exception.getResponse();
    if (typeof response !== 'object' || response === null) {
      return false;
    }
    
    const responseObj = response as any;
    return responseObj.message && Array.isArray(responseObj.message);
  }

  private isDatabaseError(exception: any): boolean {
    return (
      exception?.code &&
      (exception.code.startsWith('23') || // PostgreSQL constraint violations
        exception.code.startsWith('42') || // PostgreSQL syntax errors
        exception.code === 'ECONNREFUSED' || // Connection refused
        exception.code === 'ENOTFOUND' || // DNS resolution failed
        exception.name === 'QueryFailedError' || // TypeORM/Drizzle query errors
        exception.name === 'ConnectionError')
    );
  }

  private formatValidationErrors(errors: any[]): Record<string, any> | undefined {
    if (!Array.isArray(errors)) {
      return undefined;
    }

    return {
      validationErrors: errors.map((error) => {
        if (typeof error === 'string') {
          return { message: error };
        }
        return error;
      }),
    };
  }

  private logError(
    exception: any,
    errorResponse: ErrorResponseDto,
    request: Request,
  ): void {
    const context = {
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      traceId: errorResponse.traceId,
      statusCode: errorResponse.statusCode,
      error: errorResponse.error,
    };

    if (errorResponse.statusCode >= 500) {
      this.logger.error({
        msg: 'Internal server error',
        error: exception.message,
        stack: exception.stack,
        ...context,
      });
    } else if (errorResponse.statusCode >= 400) {
      this.logger.warn({
        msg: 'Client error',
        error: exception.message,
        ...context,
      });
    } else {
      this.logger.debug({
        msg: 'Exception handled',
        error: exception.message,
        ...context,
      });
    }
  }
}