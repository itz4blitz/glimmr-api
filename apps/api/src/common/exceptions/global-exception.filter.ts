import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
// import { ValidationError } from "class-validator";
import { ErrorResponseDto } from "./error-response.dto";
import { ERROR_CODES } from "./error-codes";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.createErrorResponse(exception, request);

    // Log the error with appropriate level
    this.logError(exception, errorResponse, request);

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private createErrorResponse(
    exception: unknown,
    request: Request,
  ): ErrorResponseDto {
    const timestamp = new Date().toISOString();
    const path = request.url;
    const traceId = request.headers["x-trace-id"] as string;

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
        message: "Validation failed",
        error: ERROR_CODES.VALIDATION_ERROR,
        timestamp,
        path,
        details: this.formatValidationErrors(
          (exception as HttpException).getResponse(),
        ),
        traceId,
      };
    }

    // Handle database errors
    if (this.isDatabaseError(exception)) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Database operation failed",
        error: ERROR_CODES.DATABASE_QUERY_ERROR,
        timestamp,
        path,
        details:
          process.env.NODE_ENV === "development"
            ? { originalError: (exception as Error).message }
            : undefined,
        traceId,
      };
    }

    // Handle generic errors
    const isProduction = process.env.NODE_ENV === "production";

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: isProduction
        ? "Internal server error"
        : (exception as Error).message || "Unknown error",
      error: ERROR_CODES.INTERNAL_SERVER_ERROR,
      timestamp,
      path,
      details: isProduction
        ? undefined
        : {
            stack: (exception as Error).stack,
            name: (exception as Error).name,
          },
      traceId,
    };
  }

  private extractMessage(exceptionResponse: unknown): string {
    if (typeof exceptionResponse === "string") {
      return exceptionResponse;
    }

    if (
      exceptionResponse &&
      typeof exceptionResponse === "object" &&
      "message" in exceptionResponse
    ) {
      const message = exceptionResponse.message;
      if (Array.isArray(message)) {
        return message.join(", ");
      }
      if (typeof message === "string") {
        return message;
      }
    }

    return "An error occurred";
  }

  private extractDetails(
    exceptionResponse: unknown,
  ): Record<string, unknown> | undefined {
    if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
      const {
        message: _message,
        statusCode: _statusCode,
        error: _error,
        ...details
      } = exceptionResponse as Record<string, unknown>;
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

  private isValidationError(exception: unknown): boolean {
    if (!(exception instanceof HttpException)) {
      return false;
    }

    if (exception.getStatus() !== HttpStatus.UNPROCESSABLE_ENTITY) {
      return false;
    }

    const response = exception.getResponse();
    if (typeof response !== "object" || response === null) {
      return false;
    }

    const responseObj = response as { message?: unknown };
    return responseObj.message && Array.isArray(responseObj.message);
  }

  private isDatabaseError(exception: unknown): boolean {
    const error = exception as { code?: string; name?: string };
    return (
      !!error?.code &&
      (error.code.startsWith("23") || // PostgreSQL constraint violations
        error.code.startsWith("42") || // PostgreSQL syntax errors
        error.code === "ECONNREFUSED" || // Connection refused
        error.code === "ENOTFOUND" || // DNS resolution failed
        error.name === "QueryFailedError" || // TypeORM/Drizzle query errors
        error.name === "ConnectionError")
    );
  }

  private formatValidationErrors(
    response: unknown,
  ): Record<string, unknown> | undefined {
    if (response && typeof response === "object" && "message" in response) {
      const message = response.message;
      if (Array.isArray(message)) {
        return {
          validationErrors: message.map((error) => {
            if (typeof error === "string") {
              return { message: error };
            }
            return error;
          }),
        };
      }
    }
    return undefined;
  }

  private logError(
    exception: unknown,
    errorResponse: ErrorResponseDto,
    request: Request,
  ): void {
    const context = {
      method: request.method,
      url: request.url,
      userAgent: request.headers["user-agent"],
      ip: request.ip,
      traceId: errorResponse.traceId,
      statusCode: errorResponse.statusCode,
      error: errorResponse.error,
    };

    if (errorResponse.statusCode >= 500) {
      this.logger.error({
        msg: "Internal server error",
        error:
          exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
        ...context,
      });
    } else if (errorResponse.statusCode >= 400) {
      this.logger.warn({
        msg: "Client error",
        error:
          exception instanceof Error ? exception.message : String(exception),
        ...context,
      });
    } else {
      this.logger.debug({
        msg: "Exception handled",
        error:
          exception instanceof Error ? exception.message : String(exception),
        ...context,
      });
    }
  }
}
