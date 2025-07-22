import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DatabaseService } from '../../database/database.service';
import { StorageService } from '../../storage/storage.service';
import { QUEUE_NAMES } from '../queues/queue.config';
import { priceTransparencyFiles, prices, jobs as jobsTable, jobLogs } from '../../database/schema';
import { eq } from 'drizzle-orm';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';
import * as zlib from 'zlib';
// @ts-ignore - Types not available in container
import * as tar from 'tar-stream';
// @ts-ignore - Types not available in container
import * as unzipper from 'unzipper';

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
  payerRates?: Record<string, any>;
  rawData?: any;
}

@Injectable()
@Processor(QUEUE_NAMES.PRICE_FILE_PARSER)
export class PriceFileParserProcessor extends WorkerHost {
  private readonly BATCH_SIZE = 1000;
  private readonly MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

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

  async process(job: Job<PriceFileParseJobData>): Promise<any> {
    const { hospitalId, fileId, storageKey, filename, fileType } = job.data;
    const startTime = Date.now();
    let jobRecord: any;

    this.logger.info({
      msg: 'Starting file parsing',
      jobId: job.id,
      hospitalId,
      fileId,
      storageKey,
      filename,
      fileType,
    });

    if (!storageKey) {
      this.logger.error({
        msg: 'Storage key is missing',
        jobData: job.data,
      });
      throw new Error('Storage key is required for file parsing');
    }

    try {
      // Create job record
      const db = this.databaseService.db;
      const [newJob] = await db.insert(jobsTable).values({
        jobType: 'data_import',
        jobName: `Parse: ${filename}`,
        description: `Parsing price transparency file ${filename}`,
        status: 'running',
        queue: QUEUE_NAMES.PRICE_FILE_PARSER,
        priority: job.opts.priority || 0,
        startedAt: new Date(),
        inputData: JSON.stringify(job.data),
        createdBy: 'system',
      }).returning();
      jobRecord = newJob;

      await this.logJobEvent(jobRecord.id, 'info', 'Job started', { fileType, filename });
      await job.updateProgress({ percentage: 5, message: 'Downloading file from storage' });

      // Update file status
      await db
        .update(priceTransparencyFiles)
        .set({
          processingStatus: 'processing',
          updatedAt: new Date(),
        })
        .where(eq(priceTransparencyFiles.id, fileId));

      // Download file from storage
      const fileStream = await this.storageService.downloadToStream(storageKey);
      
      await job.updateProgress({ percentage: 10, message: 'Detecting file format' });

      // Parse file based on type
      let extractedRecords: PriceRecord[] = [];
      const detectedType = this.detectFileType(filename, fileType);

      switch (detectedType) {
        case 'csv':
          extractedRecords = await this.parseCSV(fileStream, job, jobRecord.id);
          break;
        case 'json':
          extractedRecords = await this.parseJSON(fileStream, job, jobRecord.id);
          break;
        case 'excel':
          extractedRecords = await this.parseExcel(fileStream, job, jobRecord.id);
          break;
        case 'zip':
          extractedRecords = await this.parseZip(fileStream, job, jobRecord.id, hospitalId, fileId);
          break;
        default:
          throw new Error(`Unsupported file type: ${detectedType}`);
      }

      await job.updateProgress({ percentage: 80, message: 'Storing extracted records' });

      // Store records in batches
      const totalRecords = extractedRecords.length;
      let processedRecords = 0;
      let createdRecords = 0;

      for (let i = 0; i < totalRecords; i += this.BATCH_SIZE) {
        const batch = extractedRecords.slice(i, i + this.BATCH_SIZE);
        
        const priceRecords = batch.map(record => ({
          hospitalId,
          fileId,
          code: record.code,
          codeType: record.codeType || this.detectCodeType(record.code),
          description: record.description,
          grossCharge: String(record.grossCharge),
          discountedCashPrice: record.discountedCashPrice ? String(record.discountedCashPrice) : null,
          minimumNegotiatedCharge: record.minNegotiatedRate ? String(record.minNegotiatedRate) : null,
          maximumNegotiatedCharge: record.maxNegotiatedRate ? String(record.maxNegotiatedRate) : null,
          payerSpecificNegotiatedCharges: record.payerRates ? JSON.stringify(record.payerRates) : null,
          rawData: JSON.stringify(record.rawData || {}),
          reportingPeriod: this.extractReportingPeriod(filename),
          dataSource: 'price_transparency_file',
          isActive: true,
        }));

        await db.insert(prices).values(priceRecords);
        createdRecords += priceRecords.length;
        processedRecords += batch.length;

        const progress = 80 + Math.round((processedRecords / totalRecords) * 15);
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
              type: 'exponential',
              delay: 5000,
            },
          }
        );
      }

      await job.updateProgress({ percentage: 95, message: 'Updating file status' });

      // Update file record
      await db
        .update(priceTransparencyFiles)
        .set({
          processingStatus: 'completed',
          processedAt: new Date(),
          recordCount: totalRecords,
          updatedAt: new Date(),
        })
        .where(eq(priceTransparencyFiles.id, fileId));

      await job.updateProgress({ percentage: 100, message: 'Parsing completed' });

      const duration = Date.now() - startTime;
      
      // Update job record
      await this.updateJobSuccess(jobRecord.id, {
        totalRecords,
        createdRecords,
        duration,
        queuedNormalizationJobs: Math.ceil(totalRecords / this.BATCH_SIZE),
      });

      this.logger.info({
        msg: 'File parsing completed',
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
      this.logger.error({
        msg: 'File parsing failed',
        jobId: job.id,
        fileId,
        error: error.message,
        stack: error.stack,
      });

      if (jobRecord) {
        await this.updateJobFailure(jobRecord.id, error);
      }

      // Update file status
      await this.databaseService.db
        .update(priceTransparencyFiles)
        .set({
          processingStatus: 'failed',
          errorMessage: error.message,
          updatedAt: new Date(),
        })
        .where(eq(priceTransparencyFiles.id, fileId));

      throw error;
    }
  }

  private detectFileType(filename: string, providedType: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    
    if (providedType && providedType !== 'unknown') {
      return providedType;
    }

    switch (ext) {
      case 'csv':
        return 'csv';
      case 'json':
        return 'json';
      case 'xlsx':
      case 'xls':
        return 'excel';
      case 'zip':
        return 'zip';
      default:
        // Try to detect by content
        return 'csv'; // Default to CSV
    }
  }

  private async parseCSV(
    stream: NodeJS.ReadableStream,
    job: Job,
    jobId: string
  ): Promise<PriceRecord[]> {
    return new Promise((resolve, reject) => {
      const records: PriceRecord[] = [];
      let rowCount = 0;
      let headerMap: Record<string, string> = {};

      const parser = Papa.parse(Papa.NODE_STREAM_INPUT, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        transformHeader: (header) => {
          // Normalize header names
          const normalized = header.trim().toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
          
          // Map common variations
          if (normalized.includes('code') && !normalized.includes('type')) {
            headerMap[normalized] = 'code';
          } else if (normalized.includes('description') || normalized.includes('desc')) {
            headerMap[normalized] = 'description';
          } else if (normalized.includes('gross') && normalized.includes('charge')) {
            headerMap[normalized] = 'grossCharge';
          } else if (normalized.includes('cash') && normalized.includes('price')) {
            headerMap[normalized] = 'discountedCashPrice';
          }
          
          return normalized;
        },
        step: (row: any) => {
          rowCount++;
          
          try {
            const record = this.extractPriceRecord(row.data, headerMap);
            if (record && record.code && record.description) {
              records.push(record);
            }
          } catch (error) {
            this.logger.warn({
              msg: 'Failed to parse CSV row',
              row: rowCount,
              error: error.message,
            });
          }

          if (rowCount % 1000 === 0) {
            job.updateProgress({
              percentage: 10 + Math.min(60, Math.round((rowCount / 100000) * 60)),
              message: `Parsed ${rowCount} rows`,
            });
          }
        },
        complete: () => {
          this.logJobEvent(jobId, 'info', 'CSV parsing completed', {
            totalRows: rowCount,
            extractedRecords: records.length,
          });
          resolve(records);
        },
      });

      parser.on('error', (error: Error) => {
        this.logJobEvent(jobId, 'error', 'CSV parsing error', {
          error: error.message,
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
    jobId: string
  ): Promise<PriceRecord[]> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const text = buffer.toString('utf-8');
          const data = JSON.parse(text);

          await this.logJobEvent(jobId, 'info', 'JSON file loaded', {
            size: buffer.length,
          });

          const records: PriceRecord[] = [];
          
          // Handle different JSON structures
          if (Array.isArray(data)) {
            // Direct array of price records
            for (const item of data) {
              const record = this.extractPriceRecord(item);
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
              const record = this.extractPriceRecord(item);
              if (record) {
                records.push(record);
              }
            }
          }

          await this.logJobEvent(jobId, 'info', 'JSON parsing completed', {
            extractedRecords: records.length,
          });

          resolve(records);
        } catch (error) {
          await this.logJobEvent(jobId, 'error', 'JSON parsing failed', {
            error: error.message,
          });
          reject(error);
        }
      });
    });
  }

  private async parseExcel(
    stream: NodeJS.ReadableStream,
    job: Job,
    jobId: string
  ): Promise<PriceRecord[]> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const workbook = XLSX.read(buffer, { type: 'buffer' });

          await this.logJobEvent(jobId, 'info', 'Excel file loaded', {
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
              const record = this.extractPriceRecord(row);
              if (record && record.code && record.description) {
                records.push(record);
              }
            }
          }

          await this.logJobEvent(jobId, 'info', 'Excel parsing completed', {
            sheets: workbook.SheetNames.length,
            extractedRecords: records.length,
          });

          resolve(records);
        } catch (error) {
          await this.logJobEvent(jobId, 'error', 'Excel parsing failed', {
            error: error.message,
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
    fileId: string
  ): Promise<PriceRecord[]> {
    // For ZIP files, we'll extract and queue each file separately
    await this.logJobEvent(jobId, 'info', 'ZIP file parsing not yet implemented');
    
    // TODO: Implement ZIP extraction and queue individual files
    return [];
  }

  private extractPriceRecord(data: any, headerMap?: Record<string, string>): PriceRecord | null {
    try {
      // Map fields using headerMap or direct field names
      const getField = (fieldNames: string[]): any => {
        for (const field of fieldNames) {
          if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
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

      const code = getField(['code', 'billing_code', 'procedure_code', 'cpt_code', 'drg_code', 'hcpcs_code']);
      const description = getField(['description', 'desc', 'procedure_description', 'service_description']);
      
      if (!code || !description) {
        return null;
      }

      return {
        code: String(code).trim(),
        description: String(description).trim(),
        codeType: this.detectCodeType(code),
        grossCharge: this.parseNumber(getField(['gross_charge', 'standard_charge', 'charge', 'price'])),
        discountedCashPrice: this.parseNumber(getField(['cash_price', 'discounted_cash_price', 'self_pay'])),
        minNegotiatedRate: this.parseNumber(getField(['min_negotiated_rate', 'minimum_negotiated_charge'])),
        maxNegotiatedRate: this.parseNumber(getField(['max_negotiated_rate', 'maximum_negotiated_charge'])),
        payerRates: this.extractPayerRates(data),
        rawData: data,
      };
    } catch (error) {
      this.logger.debug({
        msg: 'Failed to extract price record',
        error: error.message,
        data,
      });
      return null;
    }
  }

  private extractPriceRecordFromCMS(data: any): PriceRecord | null {
    try {
      const code = data.code || data.billing_code;
      const description = data.description;
      
      if (!code || !description) {
        return null;
      }

      const payerRates: Record<string, any> = {};
      
      // Extract payer-specific rates
      if (data.standard_charges) {
        for (const charge of data.standard_charges) {
          if (charge.payer_name && charge.negotiated_rate) {
            payerRates[charge.payer_name] = {
              rate: this.parseNumber(charge.negotiated_rate),
              billingClass: charge.billing_class,
              methodology: charge.methodology,
            };
          }
        }
      }

      return {
        code: String(code).trim(),
        description: String(description).trim(),
        codeType: data.code_type || this.detectCodeType(code),
        grossCharge: this.parseNumber(data.gross_charge),
        discountedCashPrice: this.parseNumber(data.discounted_cash_price),
        minNegotiatedRate: this.parseNumber(data.min_negotiated_charge),
        maxNegotiatedRate: this.parseNumber(data.max_negotiated_charge),
        payerRates: Object.keys(payerRates).length > 0 ? payerRates : undefined,
        rawData: data,
      };
    } catch (error) {
      this.logger.debug({
        msg: 'Failed to extract CMS price record',
        error: error.message,
      });
      return null;
    }
  }

  private extractPayerRates(data: any): Record<string, any> | undefined {
    const payerRates: Record<string, any> = {};
    
    // Look for payer-specific columns
    for (const [key, value] of Object.entries(data)) {
      if (typeof key === 'string' && value != null) {
        // Common patterns for payer rates
        if (key.toLowerCase().includes('insurance') || 
            key.toLowerCase().includes('payer') ||
            key.toLowerCase().includes('plan')) {
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
    if (!code) return 'unknown';
    
    const upperCode = code.toUpperCase();
    
    if (/^\d{5}$/.test(code) || upperCode.startsWith('CPT')) {
      return 'CPT';
    } else if (/^\d{3}$/.test(code) || upperCode.startsWith('DRG')) {
      return 'DRG';
    } else if (/^[A-Z]\d{4}$/.test(upperCode) || upperCode.startsWith('HCPCS')) {
      return 'HCPCS';
    } else if (/^[A-Z]\d{2}/.test(upperCode) || upperCode.includes('ICD')) {
      return 'ICD-10';
    }
    
    return 'other';
  }

  private parseNumber(value: any): number | undefined {
    if (value == null || value === '') {
      return undefined;
    }
    
    // Handle string numbers with currency symbols
    if (typeof value === 'string') {
      value = value.replace(/[$,]/g, '').trim();
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
        return match[1].replace(/_/g, '-');
      }
    }

    // Default to current year-month
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private async logJobEvent(
    jobId: string,
    level: string,
    message: string,
    data?: any
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
        msg: 'Failed to log job event',
        error: error.message,
        jobId,
        level,
        message,
      });
    }
  }

  private async updateJobSuccess(jobId: string, outputData: any): Promise<void> {
    const db = this.databaseService.db;
    await db
      .update(jobsTable)
      .set({
        status: 'completed',
        completedAt: new Date(),
        duration: outputData.duration,
        outputData: JSON.stringify(outputData),
        progressPercentage: 100,
        recordsProcessed: outputData.totalRecords,
        recordsCreated: outputData.createdRecords,
        updatedAt: new Date(),
      })
      .where(eq(jobsTable.id, jobId));

    await this.logJobEvent(jobId, 'info', 'Job completed successfully', outputData);
  }

  private async updateJobFailure(jobId: string, error: Error): Promise<void> {
    const db = this.databaseService.db;
    await db
      .update(jobsTable)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error.message,
        errorStack: error.stack,
        updatedAt: new Date(),
      })
      .where(eq(jobsTable.id, jobId));

    await this.logJobEvent(jobId, 'error', 'Job failed', {
      error: error.message,
      stack: error.stack,
    });
  }
}