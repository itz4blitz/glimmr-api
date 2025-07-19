import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request, Response } from 'express';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected generateKey(context: ExecutionContext, suffix: string, name: string): string {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Get client identifier (IP address or user ID for authenticated users)
    const clientId = this.getClientId(request);
    
    // Create a unique key for rate limiting
    const route = `${request.method}:${request.route?.path || request.path}`;
    return `throttle:${name}:${route}:${clientId}:${suffix}`;
  }

  protected getClientId(request: Request): string {
    // For authenticated users, use a user-specific identifier
    // For anonymous users, use IP address
    const user = (request as any).user;
    if (user && user.id) {
      return `user:${user.id}`;
    }

    // Get IP address with proxy support
    const headers = request.headers || {};
    const forwarded = headers['x-forwarded-for'] as string;
    const socket = request.socket || {} as any;
    const ip = forwarded ? forwarded.split(',')[0].trim() : socket.remoteAddress;
    return `ip:${ip}`;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest<Request>();
      const response = context.switchToHttp().getResponse<Response>();

      // Skip rate limiting for health check endpoints
      const path = request?.path || request?.url || '';
      if (this.isHealthCheckEndpoint(path)) {
        return true;
      }

      // Call the parent implementation
      const result = await super.canActivate(context);

      // Add rate limit headers (basic implementation)
      if (response && typeof response.setHeader === 'function') {
        response.setHeader('X-RateLimit-Limit', '100');
        response.setHeader('X-RateLimit-Window', '900000');
      }

      return result;
    } catch (error) {
      // If we can't get request/response objects, fall back to parent implementation
      return await super.canActivate(context);
    }
  }

  private isHealthCheckEndpoint(path: string): boolean {
    const healthPaths = [
      '/health',
      '/health/ready',
      '/health/live',
      '/metrics',
      // Also handle with API prefix
      '/api/v1/health',
      '/api/v1/health/ready',
      '/api/v1/health/live',
      '/api/v1/metrics'
    ];

    return healthPaths.includes(path);
  }
}