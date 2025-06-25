import { pgTable, uuid, varchar, text, decimal, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const analytics = pgTable('analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Metric identification
  metricName: varchar('metric_name', { length: 100 }).notNull(),
  metricType: varchar('metric_type', { length: 50 }).notNull(), // 'average', 'median', 'count', 'percentage'
  value: decimal('value', { precision: 15, scale: 4 }).notNull(),
  
  // Dimensions for filtering/grouping
  state: varchar('state', { length: 2 }),
  city: varchar('city', { length: 100 }),
  hospitalId: uuid('hospital_id'),
  serviceCategory: varchar('service_category', { length: 100 }),
  serviceName: varchar('service_name', { length: 255 }),
  
  // Time dimensions
  period: varchar('period', { length: 20 }).notNull(), // '2024-Q1', '2024-01', '2024'
  periodType: varchar('period_type', { length: 20 }).notNull(), // 'quarter', 'month', 'year'
  calculatedAt: timestamp('calculated_at').defaultNow().notNull(),
  
  // Supporting data
  sampleSize: integer('sample_size'), // Number of records used in calculation
  confidence: decimal('confidence', { precision: 5, scale: 4 }), // Statistical confidence level
  metadata: text('metadata'), // JSON string for additional context
  
  // Data lineage
  sourceQuery: text('source_query'), // SQL query used to generate this metric
  dependencies: text('dependencies'), // JSON array of dependent table/view names
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  metricIdx: index('analytics_metric_idx').on(table.metricName),
  typeIdx: index('analytics_type_idx').on(table.metricType),
  stateIdx: index('analytics_state_idx').on(table.state),
  cityIdx: index('analytics_city_idx').on(table.city),
  hospitalIdx: index('analytics_hospital_idx').on(table.hospitalId),
  categoryIdx: index('analytics_category_idx').on(table.serviceCategory),
  periodIdx: index('analytics_period_idx').on(table.period),
  periodTypeIdx: index('analytics_period_type_idx').on(table.periodType),
  calculatedAtIdx: index('analytics_calculated_at_idx').on(table.calculatedAt),
  metricPeriodIdx: index('analytics_metric_period_idx').on(table.metricName, table.period),
  statePeriodIdx: index('analytics_state_period_idx').on(table.state, table.period),
}));

// Zod schemas for validation
export const insertAnalyticSchema = createInsertSchema(analytics, {
  metricName: z.string().min(1).max(100),
  metricType: z.enum(['average', 'median', 'count', 'percentage', 'sum', 'min', 'max']),
  value: z.string().regex(/^-?\d+(\.\d{1,4})?$/),
  state: z.string().length(2).optional(),
  period: z.string().min(1).max(20),
  periodType: z.enum(['quarter', 'month', 'year', 'week', 'day']),
});

export const selectAnalyticSchema = createSelectSchema(analytics);

export type Analytic = z.infer<typeof selectAnalyticSchema>;
export type NewAnalytic = z.infer<typeof insertAnalyticSchema>;
