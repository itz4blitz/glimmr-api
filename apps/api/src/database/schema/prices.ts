import {
  pgTable,
  uuid,
  varchar,
  text,
  decimal,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { hospitals } from "./hospitals";

export const prices = pgTable(
  "prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hospitalId: uuid("hospital_id")
      .notNull()
      .references(() => hospitals.id, { onDelete: "cascade" }),
    fileId: varchar("file_id", { length: 100 }), // External file ID from price transparency file

    // Service information
    description: text("description"), // Service description
    code: varchar("code", { length: 50 }), // CPT, DRG, HCPCS codes
    codeType: varchar("code_type", { length: 20 }), // 'CPT', 'DRG', 'HCPCS', 'ICD-10'

    // Legacy fields for backward compatibility
    serviceName: varchar("service_name", { length: 255 }),
    serviceCode: varchar("service_code", { length: 50 }),
    category: varchar("category", { length: 100 }), // 'emergency', 'surgery', 'imaging', etc.

    // Pricing information
    grossCharge: decimal("gross_charge", { precision: 12, scale: 2 }),
    discountedCashPrice: decimal("discounted_cash_price", {
      precision: 12,
      scale: 2,
    }),
    minimumNegotiatedCharge: decimal("minimum_negotiated_charge", {
      precision: 12,
      scale: 2,
    }),
    maximumNegotiatedCharge: decimal("maximum_negotiated_charge", {
      precision: 12,
      scale: 2,
    }),

    // Legacy fields for backward compatibility
    minimumNegotiatedRate: decimal("minimum_negotiated_rate", {
      precision: 12,
      scale: 2,
    }),
    maximumNegotiatedRate: decimal("maximum_negotiated_rate", {
      precision: 12,
      scale: 2,
    }),

    // Payer-specific rates (JSON for flexibility)
    payerSpecificNegotiatedCharges: text("payer_specific_negotiated_charges"), // JSON string of payer-specific rates
    payerRates: text("payer_rates"), // Legacy field for backward compatibility

    // Raw data for debugging and reprocessing
    rawData: text("raw_data"), // JSON string of original row data

    // Data source and quality
    dataSource: varchar("data_source", { length: 100 }).default(
      "price_transparency_file",
    ),
    sourceUrl: text("source_url"),
    reportingPeriod: varchar("reporting_period", { length: 20 }), // '2024-Q1', '2024-01'
    lastUpdated: timestamp("last_updated").defaultNow().notNull(),
    isActive: boolean("is_active").default(true).notNull(),

    // Quality indicators
    dataQuality: varchar("data_quality", { length: 20 }).default("unknown"), // 'high', 'medium', 'low', 'unknown'
    hasNegotiatedRates: boolean("has_negotiated_rates").default(false),

    // Metadata
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("prices_hospital_idx").on(table.hospitalId),
    index("prices_service_name_idx").on(table.serviceName),
    index("prices_code_idx").on(table.code),
    index("prices_category_idx").on(table.category),
    index("prices_hospital_service_idx").on(
      table.hospitalId,
      table.serviceName,
    ),
    index("prices_hospital_code_idx").on(table.hospitalId, table.code),
    index("prices_gross_charge_idx").on(table.grossCharge),
    index("prices_active_idx").on(table.isActive),
    index("prices_last_updated_idx").on(table.lastUpdated),
    index("prices_reporting_period_idx").on(table.reportingPeriod),
    index("prices_file_id_idx").on(table.fileId),
    // Critical composite indexes for performance optimization
    index("prices_hospital_active_idx").on(table.hospitalId, table.isActive),
    index("prices_active_updated_idx").on(table.isActive, table.lastUpdated),
    index("prices_hospital_active_updated_idx").on(
      table.hospitalId,
      table.isActive,
      table.lastUpdated,
    ),
    index("prices_active_service_idx").on(table.isActive, table.serviceName),
    index("prices_active_category_idx").on(table.isActive, table.category),
    index("prices_active_gross_charge_idx").on(
      table.isActive,
      table.grossCharge,
    ),
    // For analytics queries
    index("prices_active_hospital_service_idx").on(
      table.isActive,
      table.hospitalId,
      table.serviceName,
    ),
    index("prices_hospital_reporting_period_idx").on(
      table.hospitalId,
      table.reportingPeriod,
    ),
  ],
);

// Zod schemas for validation - using manual schema definition for better compatibility
export const insertPriceSchema = z.object({
  id: z.string().uuid().optional(),
  hospitalId: z.string().uuid(),
  serviceName: z.string().min(1).max(255),
  serviceCode: z.string().max(50).optional(),
  codeType: z.string().max(20).optional(),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  grossCharge: z.string().regex(/^\d+(\.\d{1,2})?$/),
  discountedCashPrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  minimumNegotiatedRate: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  maximumNegotiatedRate: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  payerRates: z.string().optional(),
  dataSource: z.string().max(100),
  sourceUrl: z.string().optional(),
  reportingPeriod: z.string().max(20).optional(),
  lastUpdated: z.date().optional(),
  isActive: z.boolean().default(true),
  dataQuality: z.enum(["high", "medium", "low", "unknown"]).default("unknown"),
  hasNegotiatedRates: z.boolean().default(false),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const selectPriceSchema = z.object({
  id: z.string().uuid(),
  hospitalId: z.string().uuid(),
  serviceName: z.string(),
  serviceCode: z.string().nullable(),
  codeType: z.string().nullable(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  grossCharge: z.string(),
  discountedCashPrice: z.string().nullable(),
  minimumNegotiatedRate: z.string().nullable(),
  maximumNegotiatedRate: z.string().nullable(),
  payerRates: z.string().nullable(),
  dataSource: z.string(),
  sourceUrl: z.string().nullable(),
  reportingPeriod: z.string().nullable(),
  lastUpdated: z.date(),
  isActive: z.boolean(),
  dataQuality: z.string().nullable(),
  hasNegotiatedRates: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Price = z.infer<typeof selectPriceSchema>;
export type NewPrice = z.infer<typeof insertPriceSchema>;
