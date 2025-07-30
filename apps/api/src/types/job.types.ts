/**
 * Job-specific type definitions
 * These types replace generic 'unknown' types in job processing
 */

import { Job as BullJob } from "bullmq";
import { JsonObject, JsonValue } from "./common.types";

/**
 * Base job data interface
 */
export interface BaseJobData extends JsonObject {
  id?: string;
  name?: string;
  type?: string;
  params?: JsonObject;
}

/**
 * PRA scan job data
 */
export interface PraScanJobData extends BaseJobData {
  testMode?: boolean;
  states?: string[];
  force?: boolean;
}

/**
 * File download job data
 */
export interface FileDownloadJobData extends BaseJobData {
  fileId: string;
  url: string;
  hospitalId: string;
  fileName: string;
  fileType?: string;
}

/**
 * Price file parser job data
 */
export interface PriceFileParserJobData extends BaseJobData {
  fileId: string;
  filePath: string;
  hospitalId: string;
  fileType?: string;
  encoding?: string;
}

/**
 * Analytics refresh job data
 */
export interface AnalyticsRefreshJobData extends BaseJobData {
  hospitalId?: string;
  dateRange?: JsonObject & {
    start: Date | string;
    end: Date | string;
  };
  metrics?: string[];
}

/**
 * Export job data
 */
export interface ExportJobData extends BaseJobData {
  entityType: "hospitals" | "prices" | "jobs" | "analytics";
  format: "csv" | "json" | "xlsx" | "pdf";
  filters?: JsonObject;
  fields?: string[];
}

/**
 * Job result data
 */
export interface JobResult extends JsonObject {
  success: boolean;
  message?: string;
  data?: JsonObject;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

/**
 * Job log entry
 */
export interface JobLogEntry {
  timestamp: Date | string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  data?: JsonObject;
}

/**
 * Job progress data
 */
export interface JobProgress {
  current: number;
  total: number;
  percentage: number;
  message?: string;
  details?: JsonObject;
}

/**
 * Job options extended
 */
export interface ExtendedJobOptions {
  delay?: number;
  attempts?: number;
  backoff?: {
    type: "fixed" | "exponential";
    delay: number;
  };
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
  priority?: number;
  repeat?: {
    pattern?: string;
    every?: number;
    limit?: number;
  };
}

/**
 * Queue job with proper typing
 */
export type TypedJob<T extends BaseJobData = BaseJobData> = BullJob<
  T,
  JsonValue,
  string
>;

/**
 * Job state
 */
export type JobState =
  | "waiting"
  | "active"
  | "completed"
  | "failed"
  | "delayed"
  | "paused";

/**
 * Job filter criteria
 */
export interface JobFilterCriteria {
  states?: JobState[];
  startDate?: Date | string;
  endDate?: Date | string;
  queueName?: string;
  jobType?: string;
  limit?: number;
  offset?: number;
}

/**
 * Job statistics
 */
export interface JobStatistics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  total: number;
}

/**
 * Queue metrics
 */
export interface QueueMetrics {
  queueName: string;
  stats: JobStatistics;
  throughput: {
    completed: number;
    failed: number;
    period: string;
  };
  avgProcessingTime: number;
  errorRate: number;
}

/**
 * Type guards for job data
 */
export function isPraScanJobData(data: BaseJobData): data is PraScanJobData {
  return "testMode" in data || "states" in data || "force" in data;
}

export function isFileDownloadJobData(
  data: BaseJobData,
): data is FileDownloadJobData {
  return "fileId" in data && "url" in data && "hospitalId" in data;
}

export function isPriceFileParserJobData(
  data: BaseJobData,
): data is PriceFileParserJobData {
  return "fileId" in data && "filePath" in data && "hospitalId" in data;
}

export function isExportJobData(data: BaseJobData): data is ExportJobData {
  return "entityType" in data && "format" in data;
}
