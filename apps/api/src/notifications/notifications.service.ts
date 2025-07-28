import { Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { JsonObject } from "../types/common.types";
import { notifications, notificationPreferences } from "../database/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  CreateNotificationDto,
  UpdateNotificationDto,
  NotificationFiltersDto,
} from "./dto/notifications.dto";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  private get db() {
    return this.databaseService.db;
  }

  async create(createNotificationDto: CreateNotificationDto) {
    const [notification] = await this.db
      .insert(notifications)
      .values({
        ...createNotificationDto,
        type: createNotificationDto.type as "job_success" | "job_failure" | "job_warning" | "system_alert" | "user_action" | "info",
        priority: (createNotificationDto.priority || "medium") as "low" | "medium" | "high" | "urgent",
      })
      .returning();

    this.logger.log(`Created notification: ${notification.id}`);
    return notification;
  }

  async findAll(userId?: string, filters?: NotificationFiltersDto) {
    const query = this.db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt));

    const conditions = [];

    if (userId) {
      conditions.push(eq(notifications.userId, userId));
    }

    if (filters?.read !== undefined) {
      conditions.push(eq(notifications.read, filters.read));
    }

    if (filters?.type) {
      conditions.push(eq(notifications.type, filters.type as "job_success" | "job_failure" | "job_warning" | "system_alert" | "user_action" | "info"));
    }

    if (filters?.priority) {
      conditions.push(eq(notifications.priority, filters.priority as "low" | "medium" | "high" | "urgent"));
    }

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    if (filters?.limit) {
      query.limit(filters.limit);
    }

    if (filters?.offset) {
      query.offset(filters.offset);
    }

    return await query;
  }

  async findOne(id: string, userId?: string) {
    const conditions = [eq(notifications.id, id)];

    if (userId) {
      conditions.push(eq(notifications.userId, userId));
    }

    const [notification] = await this.db
      .select()
      .from(notifications)
      .where(and(...conditions));

    return notification;
  }

  async update(
    id: string,
    updateNotificationDto: UpdateNotificationDto,
    userId?: string,
  ) {
    const conditions = [eq(notifications.id, id)];

    if (userId) {
      conditions.push(eq(notifications.userId, userId));
    }

    const updateData: Record<string, JsonObject | Date | string | boolean | null> = {
      ...updateNotificationDto,
      updatedAt: new Date(),
    };

    if (updateNotificationDto.read === true && !updateData.readAt) {
      updateData.readAt = new Date();
    }

    const [updated] = await this.db
      .update(notifications)
      .set(updateData)
      .where(and(...conditions))
      .returning();

    return updated;
  }

  markAsRead(id: string, userId?: string) {
    return this.update(id, { read: true }, userId);
  }

  async markAllAsRead(userId: string) {
    await this.db
      .update(notifications)
      .set({
        read: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.read, false)),
      );

    return { success: true };
  }

  async delete(id: string, userId?: string) {
    const conditions = [eq(notifications.id, id)];

    if (userId) {
      conditions.push(eq(notifications.userId, userId));
    }

    const [deleted] = await this.db
      .delete(notifications)
      .where(and(...conditions))
      .returning();

    return deleted;
  }

  async getUnreadCount(userId: string) {
    const _result = await this.db
      .select({ count: notifications.id })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), eq(notifications.read, false)),
      );

    return { count: _result.length };
  }

  // Notification preferences
  async getPreferences(userId: string) {
    const [preferences] = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));

    // If no preferences exist, create default ones
    if (!preferences) {
      const [newPreferences] = await this.db
        .insert(notificationPreferences)
        .values({ userId })
        .returning();

      return newPreferences;
    }

    return preferences;
  }

  async updatePreferences(userId: string, updatePreferencesDto: JsonObject) {
    const [updated] = await this.db
      .update(notificationPreferences)
      .set({
        ...updatePreferencesDto,
        updatedAt: new Date(),
      })
      .where(eq(notificationPreferences.userId, userId))
      .returning();

    // If no preferences existed, create them
    if (!updated) {
      const [created] = await this.db
        .insert(notificationPreferences)
        .values({
          userId,
          ...updatePreferencesDto,
        })
        .returning();

      return created;
    }

    return updated;
  }

  // Job-related notifications
  async createJobNotification(
    jobId: string,
    userId: string,
    type: "job_success" | "job_failure" | "job_warning",
    title: string,
    message: string,
    data?: JsonObject,
  ) {
    const preferences = await this.getPreferences(userId);

    // Check if user wants this type of notification
    const shouldNotify = {
      job_success: preferences.jobSuccessEnabled,
      job_failure: preferences.jobFailureEnabled,
      job_warning: preferences.jobWarningEnabled,
    };

    if (!preferences.inAppEnabled || !shouldNotify[type]) {
      return null;
    }

    const priority =
      type === "job_failure"
        ? "high"
        : type === "job_warning"
          ? "medium"
          : "low";

    return this.create({
      userId,
      jobId,
      type: type as "email" | "in_app" | "webhook",
      priority: priority as "low" | "medium" | "high" | "urgent",
      title,
      message,
      data,
    });
  }
}
