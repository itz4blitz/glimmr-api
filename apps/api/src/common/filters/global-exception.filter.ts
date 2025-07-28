import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(GlobalExceptionFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : "Internal server error";

    // Extract error details
    const errorDetails = {
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      statusCode: httpStatus,
      message:
        typeof message === "string"
          ? message
          : (message as { message?: string })?.message || "Unknown error",
      userAgent: request.headers["user-agent"],
      ip: request.ip,
      correlationId: request.headers["x-correlation-id"] || "unknown",
    };

    // Log error with appropriate level
    if (httpStatus >= 500) {
      this.logger.error(
        {
          ...errorDetails,
          stack: exception instanceof Error ? exception.stack : undefined,
          error:
            exception instanceof Error ? exception.message : String(exception),
        },
        "Unhandled server error",
      );
    } else if (httpStatus >= 400) {
      this.logger.warn(errorDetails, "Client error");
    } else {
      this.logger.info(errorDetails, "Request processed with warning");
    }

    // Send response
    response.status(httpStatus).json({
      statusCode: httpStatus,
      message: errorDetails.message,
      error: this.getErrorName(httpStatus),
      timestamp: errorDetails.timestamp,
      path: errorDetails.path,
      ...(process.env.NODE_ENV === "development" &&
        exception instanceof Error && {
          stack: exception.stack,
        }),
    });
  }

  private getErrorName(statusCode: number): string {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return "Bad Request";
      case HttpStatus.UNAUTHORIZED:
        return "Unauthorized";
      case HttpStatus.FORBIDDEN:
        return "Forbidden";
      case HttpStatus.NOT_FOUND:
        return "Not Found";
      case HttpStatus.CONFLICT:
        return "Conflict";
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return "Unprocessable Entity";
      case HttpStatus.TOO_MANY_REQUESTS:
        return "Too Many Requests";
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return "Internal Server Error";
      case HttpStatus.BAD_GATEWAY:
        return "Bad Gateway";
      case HttpStatus.SERVICE_UNAVAILABLE:
        return "Service Unavailable";
      case HttpStatus.GATEWAY_TIMEOUT:
        return "Gateway Timeout";
      default:
        return "Unknown Error";
    }
  }
}
