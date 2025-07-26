import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { userActivityLogs, users } from "../database/schema";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { Request } from "express";
// import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  eq,
  and,
  gte,
  count,
  desc,
  inArray,
  or,
  like,
  isNotNull,
  lt,
} from "drizzle-orm";

export interface ActivityLogData {
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  request?: Request;
  success?: boolean;
  errorMessage?: string;
  duration?: number;
}

export interface ActivityContext {
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  url?: string;
  method?: string;
}

@Injectable()
export class ActivityLoggingService {
  constructor(
    private readonly databaseService: DatabaseService,
    @InjectPinoLogger(ActivityLoggingService.name)
    private readonly logger: PinoLogger,
    // private readonly eventEmitter: EventEmitter2,
  ) {}

  private get db() {
    return this.databaseService.db;
  }

  /**
   * Extract IP address from request
   */
  private extractIpAddress(request?: Request): string | undefined {
    if (!request) return undefined;

    // Check common headers used by proxies
    const forwardedFor = request.headers["x-forwarded-for"];
    if (forwardedFor) {
      return Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(",")[0].trim();
    }

    const realIp = request.headers["x-real-ip"];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fallback to socket connection
    return request.socket?.remoteAddress;
  }

  /**
   * Extract context from request
   */
  private extractContext(request?: Request): ActivityContext {
    if (!request) return {};

    return {
      ipAddress: this.extractIpAddress(request),
      userAgent: request.headers["user-agent"] as string,
      referrer: request.headers["referer"] as string,
      url: request.originalUrl || request.url,
      method: request.method,
      sessionId: (request as any).session?.id,
    };
  }

  /**
   * Sanitize sensitive data from objects
   */
  private sanitizeData(data: any): any {
    if (!data) return data;

    const sensitiveKeys = [
      "password",
      "token",
      "secret",
      "apiKey",
      "authorization",
      "cookie",
    ];

    if (typeof data === "object") {
      const sanitized = { ...data };

      for (const key of Object.keys(sanitized)) {
        if (
          sensitiveKeys.some((sensitive) =>
            key.toLowerCase().includes(sensitive),
          )
        ) {
          sanitized[key] = "[REDACTED]";
        } else if (typeof sanitized[key] === "object") {
          sanitized[key] = this.sanitizeData(sanitized[key]);
        }
      }

      return sanitized;
    }

    return data;
  }

  /**
   * Log user activity
   */
  async logActivity(data: ActivityLogData): Promise<void> {
    try {
      const context = this.extractContext(data.request);

      const activityLog = {
        userId: data.userId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: this.sanitizeData({
          ...data.metadata,
          sessionId: context.sessionId,
          url: context.url,
          method: context.method,
          referrer: context.referrer,
          duration: data.duration,
          timestamp: new Date().toISOString(),
        }),
        success: data.success ?? true,
        errorMessage: data.errorMessage,
        timestamp: new Date(),
      };

      await this.db.insert(userActivityLogs).values(activityLog);

      // Emit event for real-time monitoring
      // this.eventEmitter.emit('activity.logged', activityLog);

      this.logger.debug({ activityLog }, "Activity logged");
    } catch (error) {
      this.logger.error({ error, data }, "Failed to log activity");
    }
  }

  /**
   * Log authentication events
   */
  async logAuth(
    event: "login" | "logout" | "login_failed" | "token_refresh",
    userId?: string,
    metadata?: any,
    request?: Request,
  ) {
    await this.logActivity({
      userId,
      action: event,
      resourceType: "auth",
      metadata,
      request,
      success: event !== "login_failed",
    });
  }

  /**
   * Log page views
   */
  async logPageView(
    userId: string,
    page: string,
    metadata?: any,
    request?: Request,
  ) {
    await this.logActivity({
      userId,
      action: "page_view",
      resourceType: "navigation",
      metadata: {
        page,
        ...metadata,
      },
      request,
    });
  }

  /**
   * Log CRUD operations
   */
  async logCrud(
    operation: "create" | "read" | "update" | "delete",
    resourceType: string,
    resourceId: string,
    userId?: string,
    metadata?: any,
    request?: Request,
  ) {
    await this.logActivity({
      userId,
      action: `${resourceType}_${operation}`,
      resourceType,
      resourceId,
      metadata,
      request,
    });
  }

  /**
   * Log search operations
   */
  async logSearch(
    searchType: string,
    query: any,
    resultCount: number,
    userId?: string,
    request?: Request,
  ) {
    await this.logActivity({
      userId,
      action: `${searchType}_search`,
      resourceType: "search",
      metadata: {
        query: this.sanitizeData(query),
        resultCount,
      },
      request,
    });
  }

  /**
   * Log file operations
   */
  async logFileOperation(
    operation: "upload" | "download" | "delete" | "view",
    fileId: string,
    fileName: string,
    userId?: string,
    metadata?: any,
    request?: Request,
  ) {
    await this.logActivity({
      userId,
      action: `file_${operation}`,
      resourceType: "file",
      resourceId: fileId,
      metadata: {
        fileName,
        ...metadata,
      },
      request,
    });
  }

  /**
   * Log admin actions
   */
  async logAdminAction(
    action: string,
    targetUserId?: string,
    metadata?: any,
    adminUserId?: string,
    request?: Request,
  ) {
    await this.logActivity({
      userId: adminUserId,
      action: `admin_${action}`,
      resourceType: "admin",
      resourceId: targetUserId,
      metadata,
      request,
    });
  }

  /**
   * Get user activities with pagination
   */
  async getUserActivities(
    userId: string,
    options: { limit?: number; offset?: number; actions?: string[] } = {},
  ) {
    const { limit = 50, offset = 0, actions } = options;

    const query = this.db
      .select()
      .from(userActivityLogs)
      .where(eq(userActivityLogs.userId, userId))
      .orderBy(desc(userActivityLogs.timestamp))
      .limit(limit)
      .offset(offset);

    const activities = await query;

    if (actions && actions.length > 0) {
      return activities.filter((a) => actions.includes(a.action));
    }

    return activities;
  }

  /**
   * Get activity summary for a user
   */
  async getUserActivitySummary(userId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const activities = await this.db
      .select({
        action: userActivityLogs.action,
        count: count(),
      })
      .from(userActivityLogs)
      .where(
        and(
          eq(userActivityLogs.userId, userId),
          gte(userActivityLogs.timestamp, startDate),
        ),
      )
      .groupBy(userActivityLogs.action);

    return activities;
  }

  /**
   * Detect suspicious activity
   */
  async detectSuspiciousActivity(userId: string, ipAddress: string) {
    const recentFailedLogins = await this.db
      .select({ count: count() })
      .from(userActivityLogs)
      .where(
        and(
          eq(userActivityLogs.userId, userId),
          eq(userActivityLogs.action, "login_failed"),
          eq(userActivityLogs.ipAddress, ipAddress),
          gte(userActivityLogs.timestamp, new Date(Date.now() - 3600000)), // Last hour
        ),
      );

    if (recentFailedLogins[0]?.count > 5) {
      await this.logActivity({
        userId,
        action: "suspicious_activity_detected",
        resourceType: "security",
        metadata: {
          reason: "multiple_failed_logins",
          failedAttempts: recentFailedLogins[0].count,
          ipAddress,
        },
      });

      // this.eventEmitter.emit('security.alert', {
      //   type: 'multiple_failed_logins',
      //   userId,
      //   ipAddress,
      //   attempts: recentFailedLogins[0].count,
      // });
    }
  }

  /**
   * Get all activities with filters
   */
  async getAllActivities(
    options: {
      limit?: number;
      offset?: number;
      search?: string;
      action?: string;
      resourceType?: string;
      success?: boolean;
      timeRange?: string;
    } = {},
  ): Promise<any[]> {
    const {
      limit = 50,
      offset = 0,
      search,
      action,
      resourceType,
      success,
      timeRange,
    } = options;

    const whereConditions = [];

    if (search) {
      whereConditions.push(
        or(
          like(userActivityLogs.action, `%${search}%`),
          like(userActivityLogs.resourceType, `%${search}%`),
          like(userActivityLogs.metadata, `%${search}%`),
        ),
      );
    }

    if (action) {
      whereConditions.push(like(userActivityLogs.action, `%${action}%`));
    }

    if (resourceType) {
      whereConditions.push(eq(userActivityLogs.resourceType, resourceType));
    }

    if (success !== undefined) {
      whereConditions.push(eq(userActivityLogs.success, success));
    }

    if (timeRange) {
      const now = new Date();
      let startTime: Date;

      switch (timeRange) {
        case "1h":
          startTime = new Date(now.getTime() - 3600000);
          break;
        case "24h":
          startTime = new Date(now.getTime() - 86400000);
          break;
        case "7d":
          startTime = new Date(now.getTime() - 604800000);
          break;
        case "30d":
          startTime = new Date(now.getTime() - 2592000000);
          break;
        default:
          startTime = new Date(now.getTime() - 86400000); // Default to 24h
      }

      whereConditions.push(gte(userActivityLogs.timestamp, startTime));
    }

    const whereClause =
      whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const activities = await this.db
      .select({
        id: userActivityLogs.id,
        userId: userActivityLogs.userId,
        action: userActivityLogs.action,
        resourceType: userActivityLogs.resourceType,
        resourceId: userActivityLogs.resourceId,
        metadata: userActivityLogs.metadata,
        ipAddress: userActivityLogs.ipAddress,
        userAgent: userActivityLogs.userAgent,
        success: userActivityLogs.success,
        errorMessage: userActivityLogs.errorMessage,
        timestamp: userActivityLogs.timestamp,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
      .from(userActivityLogs)
      .leftJoin(users, eq(userActivityLogs.userId, users.id))
      .where(whereClause)
      .orderBy(desc(userActivityLogs.timestamp))
      .limit(limit)
      .offset(offset);

    return activities.map((a) => ({
      ...a,
      user: a.userEmail
        ? {
            email: a.userEmail,
            firstName: a.userFirstName,
            lastName: a.userLastName,
          }
        : undefined,
      metadata: a.metadata ? JSON.parse(a.metadata as string) : {},
    }));
  }

  /**
   * Get activity count with filters
   */
  async getActivityCount(
    options: {
      search?: string;
      action?: string;
      resourceType?: string;
      success?: boolean;
      timeRange?: string;
    } = {},
  ): Promise<number> {
    const { search, action, resourceType, success, timeRange } = options;

    const whereConditions = [];

    if (search) {
      whereConditions.push(
        or(
          like(userActivityLogs.action, `%${search}%`),
          like(userActivityLogs.resourceType, `%${search}%`),
          like(userActivityLogs.metadata, `%${search}%`),
        ),
      );
    }

    if (action) {
      whereConditions.push(like(userActivityLogs.action, `%${action}%`));
    }

    if (resourceType) {
      whereConditions.push(eq(userActivityLogs.resourceType, resourceType));
    }

    if (success !== undefined) {
      whereConditions.push(eq(userActivityLogs.success, success));
    }

    if (timeRange) {
      const now = new Date();
      let startTime: Date;

      switch (timeRange) {
        case "1h":
          startTime = new Date(now.getTime() - 3600000);
          break;
        case "24h":
          startTime = new Date(now.getTime() - 86400000);
          break;
        case "7d":
          startTime = new Date(now.getTime() - 604800000);
          break;
        case "30d":
          startTime = new Date(now.getTime() - 2592000000);
          break;
        default:
          startTime = new Date(now.getTime() - 86400000); // Default to 24h
      }

      whereConditions.push(gte(userActivityLogs.timestamp, startTime));
    }

    const whereClause =
      whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [result] = await this.db
      .select({ count: count() })
      .from(userActivityLogs)
      .where(whereClause);

    return result?.count || 0;
  }

  /**
   * Get activity statistics
   */
  async getActivityStats(timeRange: string = "24h"): Promise<any> {
    const now = new Date();
    let startTime: Date;

    switch (timeRange) {
      case "1h":
        startTime = new Date(now.getTime() - 3600000);
        break;
      case "24h":
        startTime = new Date(now.getTime() - 86400000);
        break;
      case "7d":
        startTime = new Date(now.getTime() - 604800000);
        break;
      case "30d":
        startTime = new Date(now.getTime() - 2592000000);
        break;
      default:
        startTime = new Date(now.getTime() - 86400000); // Default to 24h
    }

    // Total activities
    const [totalResult] = await this.db
      .select({ count: count() })
      .from(userActivityLogs)
      .where(gte(userActivityLogs.timestamp, startTime));

    const totalActivities = totalResult?.count || 0;

    // Successful activities
    const [successResult] = await this.db
      .select({ count: count() })
      .from(userActivityLogs)
      .where(
        and(
          gte(userActivityLogs.timestamp, startTime),
          eq(userActivityLogs.success, true),
        ),
      );

    const successfulActivities = successResult?.count || 0;

    // Failed activities
    const failedActivities = totalActivities - successfulActivities;

    // Unique users
    const uniqueUsersResult = await this.db
      .selectDistinct({ userId: userActivityLogs.userId })
      .from(userActivityLogs)
      .where(
        and(
          gte(userActivityLogs.timestamp, startTime),
          isNotNull(userActivityLogs.userId),
        ),
      );

    const uniqueUsers = uniqueUsersResult.length;

    // Top actions
    const topActionsResult = await this.db
      .select({
        action: userActivityLogs.action,
        count: count(),
      })
      .from(userActivityLogs)
      .where(gte(userActivityLogs.timestamp, startTime))
      .groupBy(userActivityLogs.action)
      .orderBy(desc(count()))
      .limit(10);

    const topActions = topActionsResult.map((r) => ({
      action: r.action,
      count: r.count,
    }));

    // Activity by hour (last 24 hours)
    const hourlyActivity = [];
    for (let i = 0; i < 24; i++) {
      const hourStart = new Date(now.getTime() - (i + 1) * 3600000);
      const hourEnd = new Date(now.getTime() - i * 3600000);

      const [hourResult] = await this.db
        .select({ count: count() })
        .from(userActivityLogs)
        .where(
          and(
            gte(userActivityLogs.timestamp, hourStart),
            lt(userActivityLogs.timestamp, hourEnd),
          ),
        );

      hourlyActivity.push({
        hour: 23 - i,
        count: hourResult?.count || 0,
      });
    }

    return {
      totalActivities,
      successfulActivities,
      failedActivities,
      uniqueUsers,
      topActions,
      activityByHour: hourlyActivity.reverse(),
    };
  }
}
