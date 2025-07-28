import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { JsonObject } from "../types/common.types";
import {
  CreateNotificationDto,
  UpdateNotificationDto,
  NotificationFiltersDto,
  UpdateNotificationPreferencesDto,
} from "./dto/notifications.dto";

@ApiTags("Notifications")
@Controller("notifications")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @ApiOperation({ summary: "Create a new notification" })
  @ApiResponse({
    status: 201,
    description: "Notification created successfully",
  })
  create(@Body() createNotificationDto: CreateNotificationDto, @Request() req) {
    // If no userId provided, use the current user
    if (!createNotificationDto.userId) {
      createNotificationDto.userId = req.user.id;
    }
    return this.notificationsService.create(createNotificationDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all notifications for the current user" })
  @ApiResponse({ status: 200, description: "Return all notifications" })
  findAll(@Request() req, @Query() filters: NotificationFiltersDto) {
    return this.notificationsService.findAll(req.user.id, filters);
  }

  @Get("unread-count")
  @ApiOperation({
    summary: "Get unread notification count for the current user",
  })
  @ApiResponse({ status: 200, description: "Return unread count" })
  getUnreadCount(@Request() req) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Get("preferences")
  @ApiOperation({
    summary: "Get notification preferences for the current user",
  })
  @ApiResponse({ status: 200, description: "Return notification preferences" })
  getPreferences(@Request() req) {
    return this.notificationsService.getPreferences(req.user.id);
  }

  @Put("preferences")
  @ApiOperation({
    summary: "Update notification preferences for the current user",
  })
  @ApiResponse({ status: 200, description: "Preferences updated successfully" })
  updatePreferences(
    @Request() req,
    @Body() updatePreferencesDto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(
      req.user.id,
      updatePreferencesDto as JsonObject,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a specific notification" })
  @ApiResponse({ status: 200, description: "Return the notification" })
  @ApiResponse({ status: 404, description: "Notification not found" })
  findOne(@Param("id") id: string, @Request() req) {
    return this.notificationsService.findOne(id, req.user.id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update a notification" })
  @ApiResponse({
    status: 200,
    description: "Notification updated successfully",
  })
  update(
    @Param("id") id: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
    @Request() req,
  ) {
    return this.notificationsService.update(
      id,
      updateNotificationDto,
      req.user.id,
    );
  }

  @Put(":id/read")
  @ApiOperation({ summary: "Mark a notification as read" })
  @ApiResponse({ status: 200, description: "Notification marked as read" })
  markAsRead(@Param("id") id: string, @Request() req) {
    return this.notificationsService.markAsRead(id, req.user.id);
  }

  @Put("mark-all-read")
  @ApiOperation({
    summary: "Mark all notifications as read for the current user",
  })
  @ApiResponse({ status: 200, description: "All notifications marked as read" })
  markAllAsRead(@Request() req) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a notification" })
  @ApiResponse({
    status: 200,
    description: "Notification deleted successfully",
  })
  delete(@Param("id") id: string, @Request() req) {
    return this.notificationsService.delete(id, req.user.id);
  }
}
