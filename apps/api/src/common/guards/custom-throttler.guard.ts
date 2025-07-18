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
    const connection = request.connection || {};
    const ip = forwarded ? forwarded.split(',')[0].trim() : connection.remoteAddress;
    return `ip:${ip}`;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    
    // Call the parent implementation
    const result = await super.canActivate(context);
    
    // Add rate limit headers (basic implementation)
    response.setHeader('X-RateLimit-Limit', '100');
    response.setHeader('X-RateLimit-Window', '900000');
    
    return result;
  }
}