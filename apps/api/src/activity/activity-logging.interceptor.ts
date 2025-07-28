import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { ActivityLoggingService } from "./activity-logging.service";
import { Request } from "express";
import { Reflector } from "@nestjs/core";
import {
  shouldLogActivity,
  getActivityConfig,
  DEFAULT_ACTIVITY_CONFIG,
} from "./activity-config";
import { AuthenticatedRequest, SanitizedValue } from "./types";

export const SKIP_ACTIVITY_LOG = "skipActivityLog";
export const ACTIVITY_ACTION = "activityAction";
export const ACTIVITY_RESOURCE = "activityResource";

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
    const skipLog = this.reflector.getAllAndOverride<boolean>(
      SKIP_ACTIVITY_LOG,
      [handler, controller],
    );

    if (skipLog) {
      return next.handle();
    }

    // Get custom action name if provided
    const customAction = this.reflector.get<string>(ACTIVITY_ACTION, handler);
    const resourceType = this.reflector.get<string>(
      ACTIVITY_RESOURCE,
      controller,
    );

    const user = (request as AuthenticatedRequest).user;
    const startTime = Date.now();

    // Extract action from route
    const method = request.method;
    const path = request.route?.path || request.path;
    const action = customAction || this.generateAction(method, path);

    return next.handle().pipe(
      tap({
        next: (_response) => {
          const duration = Date.now() - startTime;

          // Don't log certain endpoints
          if (this.shouldSkipEndpoint(path)) {
            return;
          }

          // Check if this action should be logged based on configuration
          if (!shouldLogActivity(action)) {
            return;
          }

          // Get activity configuration
          const activityConfig =
            getActivityConfig(action) || DEFAULT_ACTIVITY_CONFIG;

          // Log the activity
          this.activityLoggingService
            .logActivity({
              userId: user?.id?.toString(),
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
                bodySize: request.body
                  ? JSON.stringify(request.body).length
                  : 0,
                userAgent: request.headers["user-agent"],
                category: activityConfig.category,
                importance: activityConfig.importance,
              },
              request,
              success: true,
            })
            .catch((err) => {
              console.error("Failed to log activity:", err);
            });
        },
        error: (error) => {
          const duration = Date.now() - startTime;

          // For failed requests, always log if it's a meaningful action
          const failedAction = `${action}_failed`;
          if (!shouldLogActivity(action) && !shouldLogActivity(failedAction)) {
            return;
          }

          const activityConfig =
            getActivityConfig(failedAction) ||
            getActivityConfig(action) ||
            DEFAULT_ACTIVITY_CONFIG;

          // Log failed requests
          this.activityLoggingService
            .logActivity({
              userId: user?.id?.toString(),
              action: `${action}_failed`,
              resourceType: resourceType || this.extractResourceType(path),
              resourceId: this.extractResourceId(path, request.params),
              metadata: {
                endpoint: path,
                method,
                duration,
                statusCode: error.status || 500,
                errorMessage: (error as Error).message,
                errorCode: error.code,
                query: this.sanitizeQuery(request.query),
                params: this.sanitizeParams(request.params),
                userAgent: request.headers["user-agent"],
                category: activityConfig.category,
                importance: activityConfig.importance,
              },
              request,
              success: false,
              errorMessage: (error as Error).message,
            })
            .catch((err) => {
              console.error("Failed to log activity error:", err);
            });
        },
      }),
    );
  }

  private generateAction(method: string, path: string): string {
    // Extract meaningful action from method and path
    const pathParts = path.split("/").filter((p) => p && !p.startsWith(":"));

    // System tracking actions (these should be filtered)
    if (path.includes("/activity/page-view")) return "page_view";
    if (path.includes("/activity/session")) return "session_activity";

    // Authentication & Security actions
    if (path.includes("/login")) return "auth_login";
    if (path.includes("/logout")) return "auth_logout";
    if (path.includes("/register")) return "auth_register";
    if (path.includes("/refresh")) return "auth_refresh";
    if (path.includes("/password-reset")) return "password_reset";
    if (path.includes("/password-change")) return "password_change";
    if (path.includes("/verify-email")) return "email_verify";
    if (path.includes("/resend-verification"))
      return "email_resend_verification";

    // Profile and account actions
    if (path.includes("/profile")) {
      if (method === "GET" && path.endsWith("/profile")) return "profile_view";
      if (method === "PUT" && path.endsWith("/profile"))
        return "profile_update";
      if (path.includes("/activity")) return "activity_view";
      if (path.includes("/avatar") && method === "POST") return "avatar_upload";
      if (path.includes("/avatar") && method === "DELETE")
        return "avatar_remove";
      if (path.includes("/preferences")) return "preferences_update";
    }

    // File operations
    if (path.includes("/files") || path.includes("/upload")) {
      // Skip listing files - this is just viewing, not downloading
      if (method === "GET" && path.endsWith("/files")) return "files_list_view";
      if (method === "POST") return "file_upload";
      if (method === "GET") return "file_download";
      if (method === "DELETE") return "file_delete";
    }

    // Job-related actions
    if (path.includes("/jobs")) {
      if (path.includes("/pra/scan")) return "job_pra_scan_trigger";
      if (path.includes("/pra/full-refresh")) return "job_pra_full_refresh";
      if (path.includes("/cleanup")) return "job_cleanup_trigger";
      if (path.includes("/analytics/refresh")) return "job_analytics_refresh";
      if (path.includes("/price-update")) return "job_price_update";
      if (path.includes("/hospital-import")) return "job_hospital_import";
    }

    // User management actions (admin)
    if (path.includes("/users")) {
      if (path.includes("/bulk")) return "bulk_operation";
      if (path.includes("/activate")) return "user_activate";
      if (path.includes("/deactivate")) return "user_deactivate";
      if (path.includes("/role")) return "user_role_update";
      if (path.includes("/export")) return "data_export";
      if (path.includes("/import")) return "user_import";
      if (path.includes("/api-key"))
        return method === "POST" ? "api_key_generate" : "api_key_revoke";
    }

    // View actions (these will be filtered out by configuration)
    if (method === "GET") {
      if (path.includes("/hospitals")) return "hospitals_view";
      if (path.includes("/prices")) return "prices_view";
      if (path.includes("/analytics")) return "analytics_view";
      if (path.includes("/notifications")) return "notifications_view";
      if (path.includes("/users") && !path.includes("/files"))
        return "users_view";
      if (path.includes("/jobs")) return "jobs_view";
      if (path.includes("/status")) return "status_view";
      if (path.includes("/stats")) return "stats_view";
    }

    // Default pattern: resource_action
    const resource = pathParts[pathParts.length - 1] || "resource";
    const actionMap: Record<string, string> = {
      GET: "view",
      POST: "create",
      PUT: "update",
      PATCH: "update",
      DELETE: "delete",
    };

    return `${resource}_${actionMap[method] || method.toLowerCase()}`;
  }

  private shouldSkipEndpoint(path: string): boolean {
    const skipPaths = [
      "/api/v1/health",
      "/api/v1/health/ready",
      "/api/v1/health/live",
      "/api/v1/activity/page-view",
      "/api/v1/activity/session",
      "/api/docs",
      "/favicon.ico",
      "/api/v1/metrics",
      "/api/v1/status",
    ];

    // Skip all GET requests that are just fetching lists or viewing data
    if (path.match(/\/(activity|notifications|messages|logs)$/)) {
      return true;
    }

    return skipPaths.some((skip) => path.includes(skip));
  }

  private sanitizeQuery(query: any): SanitizedValue {
    if (!query) return {};

    const sanitized: SanitizedValue = {};
    const sensitiveParams = ["password", "token", "apiKey", "secret"];

    for (const [key, value] of Object.entries(query)) {
      if (sensitiveParams.some((param) => key.toLowerCase().includes(param))) {
        sanitized[key] = "[REDACTED]";
      } else if (value === null || value === undefined) {
        sanitized[key] = null;
      } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(v => typeof v === 'string' ? v : String(v));
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeQuery(value);
      } else {
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }

  private sanitizeParams(params: any): SanitizedValue {
    if (!params) return {};

    const sanitized: SanitizedValue = {};
    const sensitiveParams = ["password", "token", "apiKey", "secret"];

    for (const [key, value] of Object.entries(params)) {
      if (sensitiveParams.some((param) => key.toLowerCase().includes(param))) {
        sanitized[key] = "[REDACTED]";
      } else if (value === null || value === undefined) {
        sanitized[key] = null;
      } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else {
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }

  private extractResourceType(path: string): string {
    const pathParts = path
      .split("/")
      .filter((p) => p && !p.startsWith(":") && p !== "api" && p !== "v1");

    // Common resource mappings
    if (path.includes("/users")) return "user";
    if (path.includes("/hospitals")) return "hospital";
    if (path.includes("/prices")) return "price";
    if (path.includes("/jobs")) return "job";
    if (path.includes("/analytics")) return "analytics";
    if (path.includes("/auth")) return "auth";
    if (path.includes("/profile")) return "profile";
    if (path.includes("/notifications")) return "notification";

    // Default to first meaningful path segment
    return pathParts[0] || "api";
  }

  private extractResourceId(path: string, params: Record<string, string>): string | undefined {
    // Common ID parameter names
    const idParams = [
      "id",
      "userId",
      "hospitalId",
      "priceId",
      "fileId",
      "jobId",
      "notificationId",
    ];

    for (const param of idParams) {
      const value = params?.[param];
      if (value) {
        return String(value);
      }
    }

    // Check path segments for UUIDs
    const pathSegments = path.split("/");
    for (const segment of pathSegments) {
      if (
        segment.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        )
      ) {
        return segment;
      }
    }

    return undefined;
  }
}
