import { pgTable, uuid, varchar, text, integer, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { hospitals } from './hospitals';

export const priceTransparencyFiles = pgTable('price_transparency_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  hospitalId: uuid('hospital_id').notNull().references(() => hospitals.id, { onDelete: 'cascade' }),
  externalFileId: varchar('external_file_id', { length: 100 }).notNull(),
  
  // File metadata
  filename: varchar('filename', { length: 500 }).notNull(),
  fileType: varchar('file_type', { length: 10 }).notNull(), // 'csv', 'xlsx', 'zip'
  fileSize: integer('file_size'), // in bytes
  fileUrl: text('file_url'),
  storageKey: varchar('storage_key', { length: 500 }), // S3/MinIO object key
  fileHash: varchar('file_hash', { length: 64 }), // SHA256 hash of file content
  
  // Processing metadata
  lastRetrieved: timestamp('last_retrieved'), // When file was last retrieved from source
  processedAt: timestamp('processed_at'), // When file was last processed
  recordCount: integer('record_count'), // Number of price records extracted
  
  // Status tracking
  processingStatus: varchar('processing_status', { length: 20 }).default('pending'), // 'pending', 'processing', 'completed', 'failed'
  errorMessage: text('error_message'),
  isActive: boolean('is_active').default(true).notNull(),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  hospitalIdx: index('price_files_hospital_idx').on(table.hospitalId),
  externalFileIdx: index('price_files_external_id_idx').on(table.externalFileId),
  statusIdx: index('price_files_status_idx').on(table.processingStatus),
  retrievedIdx: index('price_files_retrieved_idx').on(table.lastRetrieved),
  processedIdx: index('price_files_processed_idx').on(table.processedAt),
  activeIdx: index('price_files_active_idx').on(table.isActive),
  // Unique compound index to ensure one external file ID per hospital
  hospitalExternalFileIdx: uniqueIndex('price_files_hospital_external_id_idx').on(table.hospitalId, table.externalFileId),
}));

// Zod schemas for validation
export const insertPriceTransparencyFileSchema = createInsertSchema(priceTransparencyFiles, {
  filename: z.string().min(1).max(500),
  fileType: z.enum(['csv', 'xlsx', 'xls', 'zip']),
  fileSize: z.number().int().positive().optional(),
  fileUrl: z.string().url().optional(),
  processingStatus: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
});

export const selectPriceTransparencyFileSchema = createSelectSchema(priceTransparencyFiles);

export type PriceTransparencyFile = z.infer<typeof selectPriceTransparencyFileSchema>;
export type NewPriceTransparencyFile = z.infer<typeof insertPriceTransparencyFileSchema>;
