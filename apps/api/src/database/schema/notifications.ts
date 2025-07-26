import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { jobs } from "./jobs";

export const notificationTypeEnum = pgEnum("notification_type", [
  "job_success",
  "job_failure",
  "job_warning",
  "system_alert",
  "user_action",
  "info",
]);

export const notificationPriorityEnum = pgEnum("notification_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  priority: notificationPriorityEnum("priority").notNull().default("medium"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  data: jsonb("data"),
  read: boolean("read").notNull().default(false),
  readAt: timestamp("read_at"),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  jobSuccessEnabled: boolean("job_success_enabled").notNull().default(true),
  jobFailureEnabled: boolean("job_failure_enabled").notNull().default(true),
  jobWarningEnabled: boolean("job_warning_enabled").notNull().default(true),
  systemAlertEnabled: boolean("system_alert_enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Relations
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  job: one(jobs, {
    fields: [notifications.jobId],
    references: [jobs.id],
  }),
}));

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreferences.userId],
      references: [users.id],
    }),
  }),
);
