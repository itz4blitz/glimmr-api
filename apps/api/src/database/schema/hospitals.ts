import { pgTable, uuid, varchar, text, integer, decimal, timestamp, boolean, index, json } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const hospitals = pgTable('hospitals', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  state: varchar('state', { length: 2 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  address: text('address'),
  zipCode: varchar('zip_code', { length: 10 }),
  phone: varchar('phone', { length: 20 }),
  website: text('website'),
  email: varchar('email', { length: 255 }),
  
  // Hospital characteristics
  bedCount: integer('bed_count'),
  ownership: varchar('ownership', { length: 50 }), // 'public', 'private', 'non-profit'
  hospitalType: varchar('hospital_type', { length: 50 }), // 'general', 'specialty', 'critical_access'
  teachingStatus: boolean('teaching_status').default(false),
  traumaLevel: varchar('trauma_level', { length: 10 }), // 'I', 'II', 'III', 'IV'
  
  // External identifiers
  externalId: varchar('external_id', { length: 100 }).unique(), // Patient Rights Advocate ID
  npiNumber: varchar('npi_number', { length: 10 }).unique(),
  cmsProviderNumber: varchar('cms_provider_number', { length: 6 }).unique(),
  ccn: varchar('ccn', { length: 10 }), // CMS Certification Number

  // Geographic data
  latitude: decimal('latitude', { precision: 10, scale: 8 }),
  longitude: decimal('longitude', { precision: 11, scale: 8 }),

  // Price transparency data
  priceTransparencyFiles: text('price_transparency_files'), // JSON string of files
  lastFileCheck: timestamp('last_file_check'),

  // Data source tracking
  dataSource: varchar('data_source', { length: 100 }).notNull(), // 'cms', 'manual', 'api', 'patient_rights_advocate'
  sourceUrl: text('source_url'),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: index('hospitals_name_idx').on(table.name),
  stateIdx: index('hospitals_state_idx').on(table.state),
  cityIdx: index('hospitals_city_idx').on(table.city),
  stateCity: index('hospitals_state_city_idx').on(table.state, table.city),
  npiIdx: index('hospitals_npi_idx').on(table.npiNumber),
  cmsIdx: index('hospitals_cms_idx').on(table.cmsProviderNumber),
  activeIdx: index('hospitals_active_idx').on(table.isActive),
  lastUpdatedIdx: index('hospitals_last_updated_idx').on(table.lastUpdated),
  // Composite indexes for performance optimization
  activeStateIdx: index('hospitals_active_state_idx').on(table.isActive, table.state),
  activeStateCityIdx: index('hospitals_active_state_city_idx').on(table.isActive, table.state, table.city),
  activeLastUpdatedIdx: index('hospitals_active_last_updated_idx').on(table.isActive, table.lastUpdated),
  ccnIdx: index('hospitals_ccn_idx').on(table.ccn), // For hospital sync lookup optimization
}));

// Zod schemas for validation
export const insertHospitalSchema = createInsertSchema(hospitals, {
  name: z.string().min(1).max(255),
  state: z.string().length(2),
  city: z.string().min(1).max(100),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  bedCount: z.number().int().positive().optional(),
  npiNumber: z.string().length(10).optional(),
  cmsProviderNumber: z.string().length(6).optional(),
});

export const selectHospitalSchema = createSelectSchema(hospitals);

export type Hospital = z.infer<typeof selectHospitalSchema>;
export type NewHospital = z.infer<typeof insertHospitalSchema>;
