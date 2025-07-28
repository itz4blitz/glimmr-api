import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request as Req,
  Get,
  Query,
  Res,
} from "@nestjs/common";
import { Request, Response } from "express";
import { IsString, IsOptional, IsObject, IsIn } from "class-validator";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiProperty,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { ActivityLoggingService } from "./activity-logging.service";
import { SkipActivityLog } from "./activity-logging.decorator";

export class PageViewDto {
  @ApiProperty({ description: "The page path being viewed" })
  @IsString()
  page: string;

  @ApiProperty({ description: "The referrer URL", required: false })
  @IsOptional()
  @IsString()
  referrer?: string;

  @ApiProperty({ description: "Additional metadata", required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SessionActivityDto {
  @ApiProperty({
    description: "Session action type",
    enum: ["start", "ping", "end"],
  })
  @IsString()
  @IsIn(["start", "ping", "end"])
  action: "start" | "ping" | "end";

  @ApiProperty({ description: "Additional metadata", required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

@ApiTags("Activity")
@ApiBearerAuth()
@Controller("activity")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivityController {
  constructor(
    private readonly activityLoggingService: ActivityLoggingService,
  ) {}

  @Post("page-view")
  @SkipActivityLog()
  @ApiOperation({ summary: "Track page view" })
  async trackPageView(@Body() dto: PageViewDto, @Req() req: Request & { user: { id: string } }) {
    await this.activityLoggingService.logPageView(
      req.user.id.toString(),
      dto.page,
      {
        referrer: dto.referrer,
        ...dto.metadata,
      },
      req,
    );

    return { success: true };
  }

  @Post("session")
  @SkipActivityLog()
  @ApiOperation({ summary: "Track session activity" })
  async trackSession(@Body() dto: SessionActivityDto, @Req() req: Request & { user: { id: string } }) {
    const actionMap = {
      start: "session_start",
      ping: "session_active",
      end: "session_end",
    };

    await this.activityLoggingService.logActivity({
      userId: req.user.id,
      action: actionMap[dto.action],
      resourceType: "session",
      metadata: dto.metadata,
      request: req,
    });

    return { success: true };
  }

  @Get("my-activity")
  @ApiOperation({ summary: "Get current user activity log" })
  async getMyActivity(
    @Req() req: Request & { user: { id: string } },
    @Query("limit") limit?: number,
    @Query("offset") offset?: number,
    @Query("actions") actions?: string,
  ) {
    const activities = await this.activityLoggingService.getUserActivities(
      req.user.id.toString(),
      {
        limit: Math.min(Number(limit) || 50, 200),
        offset: Number(offset) || 0,
        actions: actions ? actions.split(",") : undefined,
      },
    );

    return { activities };
  }

  @Get("my-summary")
  @ApiOperation({ summary: "Get activity summary for current user" })
  async getMyActivitySummary(
    @Req() req: Request & { user: { id: string } },
    @Query("days") days?: number,
  ) {
    const summary = await this.activityLoggingService.getUserActivitySummary(
      req.user.id.toString(),
      Number(days) || 30,
    );

    return { summary };
  }

  @Get()
  @Roles("admin", "super_admin")
  @ApiOperation({ summary: "Get all activities (admin only)" })
  async getAllActivities(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("search") search?: string,
    @Query("action") action?: string,
    @Query("resourceType") resourceType?: string,
    @Query("success") success?: string,
    @Query("timeRange") timeRange?: string,
  ) {
    const pageNum = Number(page) || 1;
    const limitNum = Math.min(Number(limit) || 20, 100);
    const offset = (pageNum - 1) * limitNum;

    const activities = await this.activityLoggingService.getAllActivities({
      limit: limitNum,
      offset,
      search,
      action,
      resourceType,
      success:
        success === "true" ? true : success === "false" ? false : undefined,
      timeRange,
    });

    const total = await this.activityLoggingService.getActivityCount({
      search,
      action,
      resourceType,
      success:
        success === "true" ? true : success === "false" ? false : undefined,
      timeRange,
    });

    return {
      activities,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  @Get("stats")
  @Roles("admin", "super_admin")
  @ApiOperation({ summary: "Get activity statistics" })
  async getActivityStats(@Query("timeRange") timeRange?: string) {
    const stats = await this.activityLoggingService.getActivityStats(
      timeRange || "24h",
    );
    return stats;
  }

  @Get("export")
  @Roles("admin", "super_admin")
  @ApiOperation({ summary: "Export activity logs" })
  async exportActivities(
    @Res() res: Response,
    @Query("format") format?: string,
    @Query("timeRange") timeRange?: string,
  ) {
    const exportFormat = format || "csv";
    const activities = await this.activityLoggingService.getAllActivities({
      limit: 10000, // Export limit
      offset: 0,
      timeRange: timeRange || "7d",
    });

    if (exportFormat === "csv") {
      const csv = this.convertToCSV(activities);
      res.header("Content-Type", "text/csv");
      res.header(
        "Content-Disposition",
        `attachment; filename="activity-logs-${new Date().toISOString().split("T")[0]}.csv"`,
      );
      res.send(csv);
    } else {
      res.json({ activities });
    }
  }

  private convertToCSV(activities: Array<{
    timestamp: Date;
    userId: string | null;
    user?: { email: string };
    action: string;
    resourceType: string | null;
    resourceId: string | null;
    success: boolean;
    ipAddress: string | null;
    userAgent: string | null;
  }>): string {
    if (activities.length === 0) return "";

    const headers = [
      "Timestamp",
      "User ID",
      "User Email",
      "Action",
      "Resource Type",
      "Resource ID",
      "Success",
      "IP Address",
      "User Agent",
    ];
    const rows = activities.map((a) => [
      a.timestamp,
      a.userId || "",
      a.user?.email || "",
      a.action,
      a.resourceType || "",
      a.resourceId || "",
      a.success ? "Yes" : "No",
      a.ipAddress || "",
      a.userAgent || "",
    ]);

    return [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
  }
}
