import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ActivityLoggingService } from './activity-logging.service';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';

export const SKIP_ACTIVITY_LOG = 'skipActivityLog';
export const ACTIVITY_ACTION = 'activityAction';
export const ACTIVITY_RESOURCE = 'activityResource';

@Injectable()
export class ActivityLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly activityLoggingService: ActivityLoggingService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const handler = context.getHandler();
    const controller = context.getClass();
    
    // Check if activity logging should be skipped
    const skipLog = this.reflector.getAllAndOverride<boolean>(SKIP_ACTIVITY_LOG, [
      handler,
      controller,
    ]);
    
    if (skipLog) {
      return next.handle();
    }
    
    // Get custom action name if provided
    const customAction = this.reflector.get<string>(ACTIVITY_ACTION, handler);
    const resourceType = this.reflector.get<string>(ACTIVITY_RESOURCE, controller);
    
    const user = (request as any).user;
    const startTime = Date.now();
    
    // Extract action from route
    const method = request.method;
    const path = request.route?.path || request.path;
    const action = customAction || this.generateAction(method, path);
    
    return next.handle().pipe(
      tap({
        next: (response) => {
          const duration = Date.now() - startTime;
          
          // Don't log certain endpoints
          if (this.shouldSkipEndpoint(path)) {
            return;
          }
          
          // Log the activity
          this.activityLoggingService.logActivity({
            userId: user?.id,
            action: action,
            resourceType: resourceType || this.extractResourceType(path),
            resourceId: this.extractResourceId(path, request.params),
            metadata: {
              endpoint: path,
              method,
              duration,
              statusCode: 200,
              query: this.sanitizeQuery(request.query),
              params: this.sanitizeParams(request.params),
              bodySize: request.body ? JSON.stringify(request.body).length : 0,
              userAgent: request.headers['user-agent'],
            },
            request,
            success: true,
          }).catch(err => {
            console.error('Failed to log activity:', err);
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          
          // Log failed requests
          this.activityLoggingService.logActivity({
            userId: user?.id,
            action: `${action}_failed`,
            resourceType: resourceType || this.extractResourceType(path),
            resourceId: this.extractResourceId(path, request.params),
            metadata: {
              endpoint: path,
              method,
              duration,
              statusCode: error.status || 500,
              errorMessage: error.message,
              errorCode: error.code,
              query: this.sanitizeQuery(request.query),
              params: this.sanitizeParams(request.params),
              userAgent: request.headers['user-agent'],
            },
            request,
            success: false,
            errorMessage: error.message,
          }).catch(err => {
            console.error('Failed to log activity error:', err);
          });
        },
      }),
    );
  }

  private generateAction(method: string, path: string): string {
    // Extract meaningful action from method and path
    const pathParts = path.split('/').filter(p => p && !p.startsWith(':'));
    
    // Special handling for common patterns
    if (path.includes('/login')) return 'auth_login';
    if (path.includes('/logout')) return 'auth_logout';
    if (path.includes('/register')) return 'auth_register';
    if (path.includes('/refresh')) return 'auth_refresh';
    if (path.includes('/password-reset')) return 'password_reset';
    if (path.includes('/verify-email')) return 'email_verify';
    if (path.includes('/resend-verification')) return 'email_resend_verification';
    
    // Job-related actions
    if (path.includes('/jobs')) {
      if (path.includes('/pra/scan')) return 'job_pra_scan_trigger';
      if (path.includes('/pra/full-refresh')) return 'job_pra_full_refresh';
      if (path.includes('/cleanup')) return 'job_cleanup_trigger';
      if (path.includes('/analytics/refresh')) return 'job_analytics_refresh';
      if (path.includes('/price-update')) return 'job_price_update';
      if (path.includes('/hospital-import')) return 'job_hospital_import';
    }
    
    // User management actions
    if (path.includes('/users')) {
      if (path.includes('/bulk')) return 'user_bulk_action';
      if (path.includes('/activate')) return 'user_activate';
      if (path.includes('/deactivate')) return 'user_deactivate';
      if (path.includes('/role')) return 'user_role_update';
      if (path.includes('/profile')) return 'user_profile_update';
      if (path.includes('/preferences')) return 'user_preferences_update';
      if (path.includes('/export')) return 'user_export';
      if (path.includes('/import')) return 'user_import';
      if (path.includes('/api-key')) return method === 'POST' ? 'api_key_generate' : 'api_key_revoke';
    }
    
    // Default pattern: resource_action
    const resource = pathParts[pathParts.length - 1] || 'resource';
    const actionMap: Record<string, string> = {
      GET: 'view',
      POST: 'create',
      PUT: 'update',
      PATCH: 'update',
      DELETE: 'delete',
    };
    
    return `${resource}_${actionMap[method] || method.toLowerCase()}`;
  }

  private shouldSkipEndpoint(path: string): boolean {
    const skipPaths = [
      '/api/v1/health',
      '/api/v1/health/ready',
      '/api/v1/health/live',
      '/api/v1/activity/page-view',
      '/api/v1/activity/session',
      '/api/docs',
      '/favicon.ico',
    ];
    
    return skipPaths.some(skip => path.includes(skip));
  }

  private sanitizeQuery(query: any): any {
    if (!query) return {};
    
    const sanitized = { ...query };
    const sensitiveParams = ['password', 'token', 'apiKey', 'secret'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveParams.some(param => key.toLowerCase().includes(param))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
  
  private sanitizeParams(params: any): any {
    if (!params) return {};
    
    const sanitized = { ...params };
    const sensitiveParams = ['password', 'token', 'apiKey', 'secret'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveParams.some(param => key.toLowerCase().includes(param))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
  
  private extractResourceType(path: string): string {
    const pathParts = path.split('/').filter(p => p && !p.startsWith(':') && p !== 'api' && p !== 'v1');
    
    // Common resource mappings
    if (path.includes('/users')) return 'user';
    if (path.includes('/hospitals')) return 'hospital';
    if (path.includes('/prices')) return 'price';
    if (path.includes('/jobs')) return 'job';
    if (path.includes('/analytics')) return 'analytics';
    if (path.includes('/auth')) return 'auth';
    if (path.includes('/profile')) return 'profile';
    if (path.includes('/notifications')) return 'notification';
    
    // Default to first meaningful path segment
    return pathParts[0] || 'api';
  }
  
  private extractResourceId(path: string, params: any): string | undefined {
    // Common ID parameter names
    const idParams = ['id', 'userId', 'hospitalId', 'priceId', 'fileId', 'jobId', 'notificationId'];
    
    for (const param of idParams) {
      if (params?.[param]) {
        return params[param];
      }
    }
    
    // Check path segments for UUIDs
    const pathSegments = path.split('/');
    for (const segment of pathSegments) {
      if (segment.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return segment;
      }
    }
    
    return undefined;
  }
}