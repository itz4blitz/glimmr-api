import { Processor, WorkerHost, InjectQueue } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { DatabaseService } from "../../database/database.service";
import { StorageService } from "../../storage/storage.service";
import { QUEUE_NAMES } from "../queues/queue.config";
import {
  priceTransparencyFiles,
  prices,
  jobs as jobsTable,
  jobLogs,
} from "../../database/schema";
import { eq } from "drizzle-orm";
import * as Papa from "papaparse";
import * as XLSX from "xlsx";
import { Readable } from "stream";
import * as zlib from "zlib";
// @ts-ignore - Types not available in container
import * as tar from "tar-stream";
import { JsonObject, JsonValue } from "../../types/common.types";
import { PriceFileParserJobData } from "../../types/job.types";
// @ts-ignore - Types not available in container
import * as unzipper from "unzipper";

export interface PriceFileParseJobData {
  hospitalId: string;
  fileId: string;
  storageKey: string;
  filename: string;
  fileType: string;
  fileSize: number;
}

interface PriceRecord {
  code: string;
  codeType?: string;
  description: string;
  grossCharge?: number;
  discountedCashPrice?: number;
  minNegotiatedRate?: number;
  maxNegotiatedRate?: number;
  payerRates?: Record<string, {
    rate?: number;
    negotiatedRate?: number;
    billingClass?: string;
    methodology?: string;
  }>;
  rawData?: JsonObject;
}

@Injectable()
@Processor(QUEUE_NAMES.PRICE_FILE_PARSER, {
  concurrency: 1, // Process 1 file at a time to prevent memory issues
  lockDuration: 3600000, // 60 minutes for very large files
  maxStalledCount: 3,
  stalledInterval: 30000, // Check for stalled jobs every 30 seconds
})
export class PriceFileParserProcessor extends WorkerHost {
  private readonly BATCH_SIZE = 500; // Reduced batch size for better memory management
  private readonly MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB - support larger files
  private readonly PROGRESS_UPDATE_INTERVAL = 5000; // Update progress every 5 seconds
  private lastProgressUpdate = 0;

  constructor(
    @InjectPinoLogger(PriceFileParserProcessor.name)
    private readonly logger: PinoLogger,
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    @InjectQueue(QUEUE_NAMES.PRICE_UPDATE)
    private readonly priceUpdateQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<PriceFileParseJobData>): Promise<{
    success: boolean;
    totalRecords: number;
    createdRecords: number;
    duration: number;
  }> {
    const { hospitalId, fileId, storageKey, filename, fileType } = job.data;
    const startTime = Date.now();
    let jobRecord: typeof jobsTable.$inferSelect;

    this.logger.info({
      msg: "Starting file parsing",
      jobId: job.id,
      hospitalId,
      fileId,
      storageKey,
      filename,
      fileType,
    });

    if (!storageKey) {
      this.logger.error({
        msg: "Storage key is missing",
        jobData: job.data,
      });
      throw new Error("Storage key is required for file parsing");
    }

    try {
      // Create job record
      const db = this.databaseService.db;
      const [newJob] = await db
        .insert(jobsTable)
        .values({
          jobType: "data_import",
          jobName: `Parse: ${filename}`,
          description: `Parsing price transparency file ${filename}`,
          status: "running",
          queue: QUEUE_NAMES.PRICE_FILE_PARSER,
          priority: job.opts.priority || 0,
          startedAt: new Date(),
          inputData: JSON.stringify(job.data),
          createdBy: "system",
        })
        .returning();
      jobRecord = newJob;

      await this.logJobEvent(jobRecord.id, "info", "Job started", {
        fileType,
        filename,
      });
      await job.updateProgress({
        percentage: 5,
        message: "Verifying file record",
      });

      // First check if the file record exists
      const [fileRecord] = await db
        .select()
        .from(priceTransparencyFiles)
        .where(eq(priceTransparencyFiles.id, fileId));

      if (!fileRecord) {
        this.logger.warn({
          msg: "File record not found - likely a stale job",
          fileId,
          hospitalId,
          filename,
          jobId: job.id,
        });

        // Mark as completed to prevent retry
        await this.updateJobSuccess(jobRecord.id, {
          skipped: true,
          reason: "File record not found - stale job",
          fileId,
          duration: Date.now() - startTime,
        });

        return {
          success: false,
          totalRecords: 0,
          createdRecords: 0,
          duration: Date.now() - startTime,
        };
      }

      await job.updateProgress({
        percentage: 8,
        message: "Downloading file from storage",
      });

      // Update file status
      await db
        .update(priceTransparencyFiles)
        .set({
          processingStatus: "processing",
          updatedAt: new Date(),
        })
        .where(eq(priceTransparencyFiles.id, fileId));

      // Download file from storage
      let fileStream;
      try {
        fileStream = await this.storageService.downloadToStream(storageKey);
      } catch (storageError) {
        this.logger.error({
          msg: "Failed to download file from storage",
          error: storageError.message,
          storageKey,
          fileId,
        });

        // Check if it's a 404 (file not found in storage)
        if (storageError.statusCode === 404 || storageError.message?.includes("NoSuchKey")) {
          await this.updateJobSuccess(jobRecord.id, {
            skipped: true,
            reason: "File not found in storage",
            storageKey,
            duration: Date.now() - startTime,
          });

          // Update file record to indicate missing file
          await db
            .update(priceTransparencyFiles)
            .set({
              processingStatus: "failed",
              errorMessage: "File not found in storage",
              updatedAt: new Date(),
            })
            .where(eq(priceTransparencyFiles.id, fileId));

          return {
            success: false,
            totalRecords: 0,
            createdRecords: 0,
            duration: Date.now() - startTime,
          };
        }

        throw storageError;
      }

      await job.updateProgress({
        percentage: 10,
        message: "Detecting file format",
      });

      // Parse file based on type
      let extractedRecords: PriceRecord[] = [];
      const detectedType = this.detectFileType(filename, fileType);

      switch (detectedType) {
        case "csv":
          extractedRecords = await this.parseCSV(fileStream, job, jobRecord.id);
          break;
        case "json":
          extractedRecords = await this.parseJSON(
            fileStream,
            job,
            jobRecord.id,
          );
          break;
        case "excel":
          extractedRecords = await this.parseExcel(
            fileStream,
            job,
            jobRecord.id,
          );
          break;
        case "zip":
          extractedRecords = await this.parseZip(
            fileStream,
            job,
            jobRecord.id,
            hospitalId,
            fileId,
          );
          break;
        case "xml":
          extractedRecords = await this.parseXML(
            fileStream,
            job,
            jobRecord.id,
          );
          break;
        default:
          // Try CSV as fallback
          this.logger.warn({
            msg: "Unknown file type, attempting CSV parse",
            detectedType,
            filename,
          });
          try {
            extractedRecords = await this.parseCSV(fileStream, job, jobRecord.id);
          } catch (csvError) {
            // If CSV fails, try JSON
            this.logger.warn({
              msg: "CSV parse failed, attempting JSON parse",
              error: csvError.message,
            });
            extractedRecords = await this.parseJSON(fileStream, job, jobRecord.id);
          }
      }

      await job.updateProgress({
        percentage: 80,
        message: "Storing extracted records",
      });

      // Store records in batches
      const totalRecords = extractedRecords.length;
      let processedRecords = 0;
      let createdRecords = 0;

      for (let i = 0; i < totalRecords; i += this.BATCH_SIZE) {
        const batch = extractedRecords.slice(i, i + this.BATCH_SIZE);

        const priceRecords = batch.map((record) => ({
          hospitalId,
          fileId,
          code: record.code,
          codeType: record.codeType || this.detectCodeType(record.code),
          description: record.description,
          grossCharge: String(record.grossCharge),
          discountedCashPrice: record.discountedCashPrice
            ? String(record.discountedCashPrice)
            : null,
          minimumNegotiatedCharge: record.minNegotiatedRate
            ? String(record.minNegotiatedRate)
            : null,
          maximumNegotiatedCharge: record.maxNegotiatedRate
            ? String(record.maxNegotiatedRate)
            : null,
          payerSpecificNegotiatedCharges: record.payerRates
            ? JSON.stringify(record.payerRates)
            : null,
          rawData: JSON.stringify(record.rawData || {}),
          reportingPeriod: this.extractReportingPeriod(filename),
          dataSource: "price_transparency_file",
          isActive: true,
        }));

        await db.insert(prices).values(priceRecords);
        createdRecords += priceRecords.length;
        processedRecords += batch.length;

        const progress =
          80 + Math.round((processedRecords / totalRecords) * 15);
        await job.updateProgress({
          percentage: progress,
          message: `Stored ${processedRecords}/${totalRecords} records`,
        });

        // Queue normalization job for this batch
        await this.priceUpdateQueue.add(
          `normalize-batch-${fileId}-${i}`,
          {
            hospitalId,
            fileId,
            priceIds: priceRecords.map(() => null), // Will be populated after insert
            batchIndex: i / this.BATCH_SIZE,
            totalBatches: Math.ceil(totalRecords / this.BATCH_SIZE),
          },
          {
            priority: 3,
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 5000,
            },
          },
        );
      }

      await job.updateProgress({
        percentage: 95,
        message: "Updating file status",
      });

      // Update file record
      await db
        .update(priceTransparencyFiles)
        .set({
          processingStatus: "completed",
          processedAt: new Date(),
          recordCount: totalRecords,
          updatedAt: new Date(),
        })
        .where(eq(priceTransparencyFiles.id, fileId));

      await job.updateProgress({
        percentage: 100,
        message: "Parsing completed",
      });

      const duration = Date.now() - startTime;

      // Update job record
      await this.updateJobSuccess(jobRecord.id, {
        totalRecords,
        createdRecords,
        duration,
        queuedNormalizationJobs: Math.ceil(totalRecords / this.BATCH_SIZE),
      });

      this.logger.info({
        msg: "File parsing completed",
        jobId: job.id,
        fileId,
        totalRecords,
        duration,
      });

      return {
        success: true,
        totalRecords,
        createdRecords,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error({
        msg: "File parsing failed",
        jobId: job.id,
        fileId,
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration,
      });

      if (jobRecord) {
        await this.updateJobFailure(jobRecord.id, error as Error, duration);
      }

      // Update file status
      await this.databaseService.db
        .update(priceTransparencyFiles)
        .set({
          processingStatus: "failed",
          errorMessage: (error as Error).message,
          updatedAt: new Date(),
        })
        .where(eq(priceTransparencyFiles.id, fileId));

      throw error;
    }
  }

  private detectFileType(filename: string, providedType: string): string {
    // If providedType is valid and not unknown, use it
    if (providedType && providedType !== "unknown" && providedType !== "") {
      return providedType;
    }

    // Extract extension more reliably
    const lowerFilename = filename.toLowerCase();
    let ext = "";
    
    // Handle cases like .csv.gz, .json.zip etc
    if (lowerFilename.includes(".")) {
      const parts = lowerFilename.split(".");
      // Check for compressed files
      if (parts.length > 2 && ["gz", "zip", "tar", "bz2", "7z", "rar"].includes(parts[parts.length - 1])) {
        // Use the extension before compression extension
        ext = parts[parts.length - 2];
        // Mark as compressed for special handling
        if (["gz", "zip", "tar", "bz2", "7z", "rar"].includes(parts[parts.length - 1])) {
          return "zip"; // Handle all compressed files as zip type
        }
      } else {
        ext = parts[parts.length - 1];
      }
    }

    // Map extension to file type
    switch (ext) {
      case "csv":
      case "txt":
        return "csv";
      case "json":
      case "js":
        return "json";
      case "xlsx":
      case "xls":
      case "xlsm":
        return "excel";
      case "zip":
      case "gz":
      case "tar":
      case "7z":
      case "rar":
      case "bz2":
        return "zip";
      case "xml":
        return "xml";
      default:
        // Try to detect by content if possible
        if (filename.includes("json") || filename.includes("JSON")) {
          return "json";
        } else if (filename.includes("xls") || filename.includes("XLS")) {
          return "excel";
        }
        
        // Default to CSV for unknown types since most hospital files are CSV
        this.logger.warn({
          msg: "Unknown file type, defaulting to CSV",
          filename,
          detectedExt: ext,
          providedType
        });
        return "csv";
    }
  }

  private async parseCSV(
    stream: NodeJS.ReadableStream,
    job: Job,
    jobId: string,
  ): Promise<PriceRecord[]> {
    return new Promise((resolve, reject) => {
      const records: PriceRecord[] = [];
      let rowCount = 0;
      const headerMap: Record<string, string> = {};

      // Create the parser
      const parser = Papa.parse(Papa.NODE_STREAM_INPUT, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        delimiter: ",", // Explicitly set delimiter
        quoteChar: '"',
        escapeChar: '"',
        delimitersToGuess: [",", "\t", "|", ";"], // Auto-detect delimiter
        transformHeader: (header) => {
          // Normalize header names
          const normalized = header
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_]/g, "");

          // Map common variations
          if (normalized.includes("code") && !normalized.includes("type")) {
            headerMap[normalized] = "code";
          } else if (
            normalized.includes("description") ||
            normalized.includes("desc")
          ) {
            headerMap[normalized] = "description";
          } else if (
            normalized.includes("gross") &&
            normalized.includes("charge")
          ) {
            headerMap[normalized] = "grossCharge";
          } else if (
            normalized.includes("cash") &&
            normalized.includes("price")
          ) {
            headerMap[normalized] = "discountedCashPrice";
          }

          return normalized;
        },
        step: (row: { data: JsonObject }) => {
          rowCount++;

          try {
            const record = this.extractPriceRecord(row.data, headerMap);
            if (record && record.code && record.description) {
              records.push(record);
            }
          } catch (error) {
            this.logger.warn({
              msg: "Failed to parse CSV row",
              row: rowCount,
              error: (error as Error).message,
            });
          }

          if (rowCount % 1000 === 0) {
            const now = Date.now();
            if (now - this.lastProgressUpdate > this.PROGRESS_UPDATE_INTERVAL) {
              this.lastProgressUpdate = now;
              
              const progressPercentage = 10 + Math.min(60, Math.round((rowCount / 100000) * 60));
              
              // Update progress and extend lock to prevent timeout
              Promise.all([
                job.updateProgress({
                  percentage: progressPercentage,
                  message: `Parsed ${rowCount} rows, ${records.length} valid records`,
                }).catch(() => {}), // Don't fail on progress update
                // Extend lock by 5 minutes to prevent stalling
                job.token ? job.extendLock(job.token, 300000).catch(err => {
                  this.logger.warn({
                    msg: "Failed to extend job lock",
                    error: (err as Error).message,
                    rowCount,
                  });
                }) : Promise.resolve()
              ]);
            }
          }
        },
        complete: () => {
          this.logJobEvent(jobId, "info", "CSV parsing completed", {
            totalRows: rowCount,
            extractedRecords: records.length,
          });
          resolve(records);
        },
      });

      parser.on("error", (error: Error) => {
        this.logJobEvent(jobId, "error", "CSV parsing error", {
          error: (error as Error).message,
          row: rowCount,
        });
        reject(error);
      });

      stream.pipe(parser);
    });
  }

  private async parseJSON(
    stream: NodeJS.ReadableStream,
    job: Job,
    jobId: string,
  ): Promise<PriceRecord[]> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const text = buffer.toString("utf-8");
          const data = JSON.parse(text);

          await this.logJobEvent(jobId, "info", "JSON file loaded", {
            size: buffer.length,
          });

          const records: PriceRecord[] = [];

          // Handle different JSON structures
          if (Array.isArray(data)) {
            // Direct array of price records
            for (const item of data) {
              const record = this.extractPriceRecord(item as JsonObject);
              if (record) {
                records.push(record);
              }
            }
          } else if (data.standard_charge_information) {
            // CMS standard format
            for (const item of data.standard_charge_information) {
              const record = this.extractPriceRecordFromCMS(item);
              if (record) {
                records.push(record);
              }
            }
          } else if (data.prices || data.items || data.charges) {
            // Common nested formats
            const items = data.prices || data.items || data.charges;
            for (const item of items) {
              const record = this.extractPriceRecord(item as JsonObject);
              if (record) {
                records.push(record);
              }
            }
          }

          await this.logJobEvent(jobId, "info", "JSON parsing completed", {
            extractedRecords: records.length,
          });

          resolve(records);
        } catch (error) {
          await this.logJobEvent(jobId, "error", "JSON parsing failed", {
            error: (error as Error).message,
          });
          reject(error);
        }
      });
    });
  }

  private async parseExcel(
    stream: NodeJS.ReadableStream,
    job: Job,
    jobId: string,
  ): Promise<PriceRecord[]> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const workbook = XLSX.read(buffer, { type: "buffer" });

          await this.logJobEvent(jobId, "info", "Excel file loaded", {
            sheets: workbook.SheetNames,
          });

          const records: PriceRecord[] = [];

          // Process each sheet
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet, {
              raw: false,
              defval: null,
            });

            await job.updateProgress({
              percentage: 20,
              message: `Processing sheet: ${sheetName}`,
            });

            for (const row of data) {
              const record = this.extractPriceRecord(row as JsonObject);
              if (record && record.code && record.description) {
                records.push(record);
              }
            }
          }

          await this.logJobEvent(jobId, "info", "Excel parsing completed", {
            sheets: workbook.SheetNames.length,
            extractedRecords: records.length,
          });

          resolve(records);
        } catch (error) {
          await this.logJobEvent(jobId, "error", "Excel parsing failed", {
            error: (error as Error).message,
          });
          reject(error);
        }
      });
    });
  }

  private async parseZip(
    stream: NodeJS.ReadableStream,
    job: Job,
    jobId: string,
    hospitalId: string,
    fileId: string,
  ): Promise<PriceRecord[]> {
    const records: PriceRecord[] = [];
    
    try {
      await this.logJobEvent(jobId, "info", "Starting ZIP file extraction");
      
      // For now, we'll treat ZIP files as containers and extract the first CSV/JSON file
      // In a production system, you would extract all files and process them separately
      const parseStream = stream.pipe(unzipper.Parse());
      
      for await (const entry of parseStream) {
        const fileName = entry.path;
        const type = this.detectFileType(fileName, "unknown");
        
        this.logger.info({
          msg: "Found file in ZIP",
          fileName,
          type,
        });
        
        if (type === "csv" || type === "json" || type === "excel") {
          await job.updateProgress({
            percentage: 15,
            message: `Extracting ${fileName} from ZIP`,
          });
          
          // Process the first supported file
          if (type === "csv") {
            const csvRecords = await this.parseCSV(entry, job, jobId);
            records.push(...csvRecords);
          } else if (type === "json") {
            const jsonRecords = await this.parseJSON(entry, job, jobId);
            records.push(...jsonRecords);
          }
          
          // Only process the first file for now
          break;
        } else {
          entry.autodrain();
        }
      }
      
      await this.logJobEvent(jobId, "info", "ZIP extraction completed", {
        extractedRecords: records.length,
      });
      
      return records;
    } catch (error) {
      await this.logJobEvent(jobId, "error", "ZIP extraction failed", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async parseXML(
    stream: NodeJS.ReadableStream,
    job: Job,
    jobId: string,
  ): Promise<PriceRecord[]> {
    const records: PriceRecord[] = [];
    const errors: string[] = [];
    let processedCount = 0;

    try {
      // Import xml2js dynamically to avoid bundling if not used
      const { parseStringPromise } = await import("xml2js");
      
      // Convert stream to string
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const xmlString = Buffer.concat(chunks).toString("utf-8");

      await this.logJobEvent(
        jobId,
        "info",
        `Parsing XML file, size: ${xmlString.length} bytes`,
      );

      // Parse XML
      const result = await parseStringPromise(xmlString, {
        explicitArray: false,
        mergeAttrs: true,
        normalize: true,
        normalizeTags: true,
      });

      // Common XML structures for price transparency files
      const possibleRootPaths = [
        result.root?.prices,
        result.prices,
        result.chargemaster?.prices,
        result.chargemaster?.items,
        result.hospital?.prices,
        result.priceList?.items,
        result.priceList?.prices,
      ];

      let priceItems: Array<JsonObject> = [];
      for (const path of possibleRootPaths) {
        if (path) {
          priceItems = Array.isArray(path) ? path : [path];
          break;
        }
      }

      // If still no items found, try to find any array in the result
      if (priceItems.length === 0) {
        const findArrays = (obj: JsonObject): Array<JsonObject> => {
          for (const key in obj) {
            if (Array.isArray(obj[key]) && obj[key].length > 0) {
              // Check if this looks like price data
              const sample = (obj[key] as JsonValue[])[0];
              if (sample && typeof sample === 'object' && sample !== null && ('code' in sample || 'price' in sample || 'charge' in sample || 'description' in sample)) {
                return obj[key] as Array<JsonObject>;
              }
            } else if (typeof obj[key] === "object" && obj[key] !== null) {
              const found = findArrays(obj[key] as JsonObject);
              if (found.length > 0) return found;
            }
          }
          return [];
        };
        priceItems = findArrays(result);
      }

      await this.logJobEvent(
        jobId,
        "info",
        `Found ${priceItems.length} price items in XML`,
      );

      // Process each item
      for (const item of priceItems) {
        processedCount++;
        
        if (processedCount % 1000 === 0) {
          await job.updateProgress(Math.min(90, (processedCount / priceItems.length) * 100));
          await this.logJobEvent(
            jobId,
            "info",
            `Processed ${processedCount}/${priceItems.length} XML items`,
          );
        }

        const record = this.extractPriceRecord(item);
        if (record) {
          records.push(record);
        }
      }

      await this.logJobEvent(
        jobId,
        "info",
        `XML parsing completed: ${records.length} valid records from ${processedCount} items`,
      );

    } catch (error) {
      await this.logJobEvent(
        jobId,
        "error",
        `XML parsing error: ${(error as Error).message}`,
      );
      errors.push(`XML parsing failed: ${(error as Error).message}`);
    }

    if (errors.length > 0) {
      await this.logJobEvent(
        jobId,
        "warn",
        `XML parsing completed with ${errors.length} errors`,
      );
    }

    return records;
  }

  private extractPriceRecord(
    data: JsonObject,
    headerMap?: Record<string, string>,
  ): PriceRecord | null {
    try {
      // Map fields using headerMap or direct field names
      const getField = (fieldNames: string[]): JsonValue => {
        for (const field of fieldNames) {
          if (
            data[field] !== undefined &&
            data[field] !== null &&
            data[field] !== ""
          ) {
            return data[field];
          }
          // Check headerMap
          if (headerMap) {
            for (const [key, mappedField] of Object.entries(headerMap)) {
              if (mappedField === field && data[key] !== undefined) {
                return data[key];
              }
            }
          }
        }
        return null;
      };

      const code = getField([
        "code",
        "billing_code",
        "procedure_code",
        "cpt_code",
        "drg_code",
        "hcpcs_code",
      ]);
      const description = getField([
        "description",
        "desc",
        "procedure_description",
        "service_description",
      ]);

      if (!code || !description) {
        return null;
      }

      return {
        code: String(code).trim(),
        description: String(description).trim(),
        codeType: this.detectCodeType(String(code)),
        grossCharge: this.parseNumber(
          getField(["gross_charge", "standard_charge", "charge", "price"]),
        ),
        discountedCashPrice: this.parseNumber(
          getField(["cash_price", "discounted_cash_price", "self_pay"]),
        ),
        minNegotiatedRate: this.parseNumber(
          getField(["min_negotiated_rate", "minimum_negotiated_charge"]),
        ),
        maxNegotiatedRate: this.parseNumber(
          getField(["max_negotiated_rate", "maximum_negotiated_charge"]),
        ),
        payerRates: this.extractPayerRates(data),
        rawData: data,
      };
    } catch (error) {
      this.logger.debug({
        msg: "Failed to extract price record",
        error: (error as Error).message,
        data,
      });
      return null;
    }
  }

  private extractPriceRecordFromCMS(data: JsonObject): PriceRecord | null {
    try {
      const code = data.code || data.billing_code;
      const description = data.description;

      if (!code || !description) {
        return null;
      }

      const payerRates: Record<string, {
        rate?: number;
        negotiatedRate?: number;
        billingClass?: string;
        methodology?: string;
      }> = {};

      // Extract payer-specific rates
      if (data.standard_charges && Array.isArray(data.standard_charges)) {
        for (const charge of data.standard_charges as Array<JsonObject>) {
          if (charge.payer_name && charge.negotiated_rate) {
            payerRates[String(charge.payer_name)] = {
              rate: this.parseNumber(charge.negotiated_rate),
              billingClass: charge.billing_class as string,
              methodology: charge.methodology as string,
            };
          }
        }
      }

      return {
        code: String(code).trim(),
        description: String(description).trim(),
        codeType: (data.code_type as string) || this.detectCodeType(String(code)),
        grossCharge: this.parseNumber(data.gross_charge),
        discountedCashPrice: this.parseNumber(data.discounted_cash_price),
        minNegotiatedRate: this.parseNumber(data.min_negotiated_charge),
        maxNegotiatedRate: this.parseNumber(data.max_negotiated_charge),
        payerRates: Object.keys(payerRates).length > 0 ? payerRates : undefined,
        rawData: data,
      };
    } catch (error) {
      this.logger.debug({
        msg: "Failed to extract CMS price record",
        error: (error as Error).message,
      });
      return null;
    }
  }

  private extractPayerRates(data: JsonObject): Record<string, {
    rate?: number;
    negotiatedRate?: number;
    billingClass?: string;
    methodology?: string;
  }> | undefined {
    const payerRates: Record<string, {
      rate?: number;
      negotiatedRate?: number;
      billingClass?: string;
      methodology?: string;
    }> = {};

    // Look for payer-specific columns
    for (const [key, value] of Object.entries(data)) {
      if (typeof key === "string" && value != null) {
        // Common patterns for payer rates
        if (
          key.toLowerCase().includes("insurance") ||
          key.toLowerCase().includes("payer") ||
          key.toLowerCase().includes("plan")
        ) {
          const rate = this.parseNumber(value);
          if (rate > 0) {
            payerRates[key] = { rate };
          }
        }
      }
    }

    return Object.keys(payerRates).length > 0 ? payerRates : undefined;
  }

  private detectCodeType(code: string): string {
    if (!code) return "unknown";

    const upperCode = code.toUpperCase();

    if (/^\d{5}$/.test(code) || upperCode.startsWith("CPT")) {
      return "CPT";
    } else if (/^\d{3}$/.test(code) || upperCode.startsWith("DRG")) {
      return "DRG";
    } else if (
      /^[A-Z]\d{4}$/.test(upperCode) ||
      upperCode.startsWith("HCPCS")
    ) {
      return "HCPCS";
    } else if (/^[A-Z]\d{2}/.test(upperCode) || upperCode.includes("ICD")) {
      return "ICD-10";
    }

    return "other";
  }

  private parseNumber(value: unknown): number | undefined {
    if (value == null || value === "") {
      return undefined;
    }

    // Handle string numbers with currency symbols
    if (typeof value === "string") {
      value = value.replace(/[$,]/g, "").trim();
    }

    const num = Number(value);
    return isNaN(num) ? undefined : num;
  }

  private extractReportingPeriod(filename: string): string {
    // Try to extract date from filename
    const datePatterns = [
      /(\d{4}[-_]\d{2}[-_]\d{2})/,
      /(\d{4}[-_]\d{2})/,
      /(\d{4})/,
      /(Q[1-4][-_]\d{4})/,
    ];

    for (const pattern of datePatterns) {
      const match = filename.match(pattern);
      if (match) {
        return match[1].replace(/_/g, "-");
      }
    }

    // Default to current year-month
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  private async logJobEvent(
    jobId: string,
    level: string,
    message: string,
    data?: unknown,
  ): Promise<void> {
    try {
      await this.databaseService.db.insert(jobLogs).values({
        jobId,
        level,
        message,
        data: data ? JSON.stringify(data) : null,
      });
    } catch (error) {
      this.logger.error({
        msg: "Failed to log job event",
        error: (error as Error).message,
        jobId,
        level,
        message,
      });
    }
  }

  private async updateJobSuccess(
    jobId: string,
    outputData: Record<string, unknown>,
  ): Promise<void> {
    const db = this.databaseService.db;
    await db
      .update(jobsTable)
      .set({
        status: "completed",
        completedAt: new Date(),
        duration: outputData.duration as number,
        outputData: JSON.stringify(outputData),
        progressPercentage: 100,
        recordsProcessed: outputData.totalRecords as number,
        recordsCreated: outputData.createdRecords as number,
        updatedAt: new Date(),
      })
      .where(eq(jobsTable.id, jobId));

    await this.logJobEvent(
      jobId,
      "info",
      "Job completed successfully",
      outputData,
    );
  }

  private async updateJobFailure(jobId: string, error: Error, duration?: number): Promise<void> {
    const db = this.databaseService.db;
    await db
      .update(jobsTable)
      .set({
        status: "failed",
        completedAt: new Date(),
        duration,
        errorMessage: (error as Error).message,
        errorStack: (error as Error).stack,
        updatedAt: new Date(),
      })
      .where(eq(jobsTable.id, jobId));

    await this.logJobEvent(jobId, "error", "Job failed", {
      error: (error as Error).message,
      stack: (error as Error).stack,
      duration,
    });
  }
}
