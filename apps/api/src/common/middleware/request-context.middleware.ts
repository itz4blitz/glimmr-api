import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { PinoLogger } from "nestjs-pino";

interface ExtendedRequest extends Request {
  requestId?: string;
  startTime?: number;
  clientIp?: string;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext("RequestContext");
  }

  use(req: ExtendedRequest, res: Response, next: NextFunction) {
    try {
      // Generate or extract request ID
      const requestId = this.extractRequestId(req);

      // Add request ID to request object for downstream use
      req.requestId = requestId;

      // Extract client IP with proper proxy support
      const clientIp = this.extractClientIp(req);
      req.clientIp = clientIp;

      // Set security and tracking headers
      this.setResponseHeaders(res, requestId);

      // Extract user context from headers
      const userAgent = req.headers["user-agent"];
      const apiKey = req.headers["x-api-key"] as string;
      const contentLength = req.headers["content-length"];

      // Store context for this request (no need to assign to logger)
      // The context will be automatically included via pinoHttp customProps

      // Track request start time for performance metrics
      const startTime = Date.now();
      req.startTime = startTime;

      // Set up response logging
      this.setupResponseLogging(req, res, startTime);

      next();
    } catch (error) {
      this.logger.error({
        msg: "Error in request context middleware",
        error: error.message,
        stack: error.stack,
      });
      next(error);
    }
  }

  private extractRequestId(req: Request): string {
    return (
      (req.headers["x-request-id"] as string) ||
      (req.headers["x-correlation-id"] as string) ||
      (req.headers["x-trace-id"] as string) ||
      `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    );
  }

  private extractClientIp(req: Request): string {
    // Check for proxy headers first (most common in production)
    const xForwardedFor = req.headers["x-forwarded-for"] as string;
    if (xForwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      return xForwardedFor.split(",")[0].trim();
    }

    // Check other common proxy headers
    const xRealIp = req.headers["x-real-ip"] as string;
    if (xRealIp) {
      return xRealIp;
    }

    const xClientIp = req.headers["x-client-ip"] as string;
    if (xClientIp) {
      return xClientIp;
    }

    // Fallback to Express IP detection (handles trust proxy)
    if (req.ip) {
      return req.ip;
    }

    // Last resort: use socket remote address (replaces deprecated req.connection)
    return req.socket?.remoteAddress || "unknown";
  }

  private setResponseHeaders(res: Response, requestId: string): void {
    // Request tracking
    res.setHeader("X-Request-ID", requestId);

    // Security headers
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");

    // API-specific headers
    res.setHeader("X-API-Version", "1.0");
    res.setHeader("X-Powered-By", "Glimmr API");
  }

  private sanitizeUserAgent(userAgent: string): string {
    // Truncate very long user agents and remove potentially sensitive info
    return userAgent.length > 200
      ? userAgent.substring(0, 200) + "..."
      : userAgent;
  }

  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) {
      return "***";
    }
    return `${apiKey.substring(0, 8)}...`;
  }

  private setupResponseLogging(
    req: ExtendedRequest,
    res: Response,
    startTime: number,
  ): void {
    const originalEnd = res.end.bind(res);
    const logger = this.logger;

    res.end = function (
      this: Response,
      chunk?: any,
      encoding?: any,
      cb?: () => void,
    ): Response {
      try {
        const responseTime = Date.now() - startTime;
        const statusCode = res.statusCode;
        const contentLength = res.getHeader("content-length");

        const logData = {
          method: req.method,
          url: req.url,
          statusCode,
          responseTime,
          requestId: req.requestId,
          userAgent: req.headers["user-agent"],
          clientIp: req.clientIp,
          contentLength: contentLength
            ? parseInt(contentLength.toString(), 10)
            : undefined,
        };

        // Log based on response characteristics
        if (statusCode >= 500) {
          logger.error({
            msg: "Request completed with server error",
            ...logData,
          });
        } else if (statusCode >= 400) {
          logger.warn({
            msg: "Request completed with client error",
            ...logData,
          });
        } else if (responseTime > 2000) {
          logger.warn({
            msg: "Slow request detected",
            ...logData,
          });
        } else if (responseTime > 1000) {
          logger.info({
            msg: "Request completed (slow)",
            ...logData,
          });
        } else {
          logger.debug({
            msg: "Request completed",
            ...logData,
          });
        }
      } catch (error) {
        logger.error({
          msg: "Error in response logging",
          error: error.message,
        });
      }

      // Call original end method with proper signature
      if (typeof chunk === "function") {
        return originalEnd(chunk);
      } else if (typeof encoding === "function") {
        return originalEnd(chunk, encoding);
      } else {
        return originalEnd(chunk, encoding, cb);
      }
    };
  }
}
