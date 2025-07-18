import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('api-user'), // 'admin', 'api-user'
  apiKey: varchar('api_key', { length: 100 }).unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  usernameIdx: index('users_username_idx').on(table.username),
  apiKeyIdx: index('users_api_key_idx').on(table.apiKey),
  roleIdx: index('users_role_idx').on(table.role),
}));

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users, {
  username: z.string().min(3).max(50),
  password: z.string().min(6),
  role: z.enum(['admin', 'api-user']),
});

export const selectUserSchema = createSelectSchema(users);

export type User = z.infer<typeof selectUserSchema>;
export type NewUser = z.infer<typeof insertUserSchema>;