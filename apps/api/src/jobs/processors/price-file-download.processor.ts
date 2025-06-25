import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { Job } from 'bullmq';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { DatabaseService } from '../../database/database.service.js';
import { priceTransparencyFiles, prices } from '../../database/schema/index.js';
import { eq } from 'drizzle-orm';
import { QUEUE_NAMES } from '../queues/queue.config.js';

export interface PriceFileDownloadJobData {
  hospitalId: string;
  fileId: string;
  fileUrl: string;
  filename: string;
  filesuffix: string;
  size: string;
  retrieved: string;
  forceReprocess?: boolean;
}

export interface PriceRecord {
  description?: string;
  code?: string;
  codeType?: string;
  grossCharge?: number;
  discountedCashPrice?: number;
  minimumNegotiatedCharge?: number;
  maximumNegotiatedCharge?: number;
  payerSpecificNegotiatedCharges?: any[];
  [key: string]: any;
}

@Injectable()
@Processor(QUEUE_NAMES.PRICE_FILE_DOWNLOAD)
export class PriceFileDownloadProcessor extends WorkerHost {
  private readonly downloadDir = path.join(process.cwd(), 'temp', 'downloads');
  private readonly maxFileSize = 500 * 1024 * 1024; // 500MB limit

  constructor(
    private readonly databaseService: DatabaseService,
    @InjectPinoLogger(PriceFileDownloadProcessor.name)
    private readonly logger: PinoLogger,
  ) {
    super();
    this.ensureDownloadDir();
  }

  async process(job: Job<PriceFileDownloadJobData>): Promise<any> {
    const { hospitalId, fileId, fileUrl, filename, filesuffix, size, retrieved, forceReprocess = false } = job.data;

    this.logger.info({
      msg: 'Starting price file download and processing',
      jobId: job.id,
      hospitalId,
      fileId,
      filename,
      filesuffix,
      size,
    });

    try {
      await job.updateProgress(0);

      // Check if file already processed
      if (!forceReprocess) {
        const existing = await this.checkExistingFile(fileId, retrieved);
        if (existing) {
          this.logger.info({
            msg: 'File already processed, skipping',
            jobId: job.id,
            fileId,
            filename,
          });
          return { status: 'skipped', reason: 'already_processed' };
        }
      }

      // Download file
      const filePath = await this.downloadFile(fileUrl, filename, job);
      await job.updateProgress(30);

      // Extract if ZIP
      let processedFiles: string[] = [];
      if (filesuffix.toLowerCase() === 'zip') {
        processedFiles = await this.extractZipFile(filePath, job);
      } else {
        processedFiles = [filePath];
      }
      await job.updateProgress(50);

      // Process each file
      let totalRecords = 0;
      for (const file of processedFiles) {
        const records = await this.processFile(file, hospitalId, fileId, job);
        totalRecords += records;
      }

      await job.updateProgress(90);

      // Record file processing
      await this.recordFileProcessing(hospitalId, fileId, filename, filesuffix, size, retrieved, totalRecords);

      // Cleanup
      await this.cleanup(filePath, processedFiles);

      await job.updateProgress(100);

      const result = {
        status: 'completed',
        hospitalId,
        fileId,
        filename,
        totalRecords,
        processedFiles: processedFiles.length,
      };

      this.logger.info({
        msg: 'Price file processing completed successfully',
        jobId: job.id,
        result,
      });

      return result;
    } catch (error) {
      this.logger.error({
        msg: 'Price file processing failed',
        jobId: job.id,
        hospitalId,
        fileId,
        filename,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  private ensureDownloadDir(): void {
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }
  }

  private async checkExistingFile(fileId: string, retrieved: string): Promise<boolean> {
    const db = this.databaseService.db;
    const existing = await db
      .select()
      .from(priceTransparencyFiles)
      .where(eq(priceTransparencyFiles.externalFileId, fileId))
      .limit(1);

    return existing.length > 0 && existing[0].lastRetrieved?.toISOString() === retrieved;
  }

  private async downloadFile(url: string, filename: string, job: Job): Promise<string> {
    const filePath = path.join(this.downloadDir, `${Date.now()}_${filename}`);

    this.logger.info({
      msg: 'Downloading file',
      url,
      filename,
      filePath,
      jobId: job.id,
    });

    try {
      const response = await axios({
        method: 'GET',
        url,
        responseType: 'stream',
        timeout: 300000, // 5 minutes
        maxContentLength: this.maxFileSize,
        headers: {
          'User-Agent': 'Glimmr-API/1.0 (Healthcare Price Transparency Aggregator)',
        },
      });

      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(filePath));
        writer.on('error', reject);
      });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to download file',
        url,
        filename,
        error: error.message,
        jobId: job.id,
      });
      throw error;
    }
  }

  private async extractZipFile(zipPath: string, job: Job): Promise<string[]> {
    this.logger.info({
      msg: 'Extracting ZIP file',
      zipPath,
      jobId: job.id,
    });

    try {
      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();
      const extractedFiles: string[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory) {
          const extractPath = path.join(this.downloadDir, `extracted_${Date.now()}_${entry.entryName}`);
          fs.writeFileSync(extractPath, entry.getData());
          extractedFiles.push(extractPath);
        }
      }

      this.logger.info({
        msg: 'ZIP extraction completed',
        zipPath,
        extractedCount: extractedFiles.length,
        jobId: job.id,
      });

      return extractedFiles;
    } catch (error) {
      this.logger.error({
        msg: 'Failed to extract ZIP file',
        zipPath,
        error: error.message,
        jobId: job.id,
      });
      throw error;
    }
  }

  private async processFile(filePath: string, hospitalId: string, fileId: string, job: Job): Promise<number> {
    const ext = path.extname(filePath).toLowerCase();
    
    this.logger.info({
      msg: 'Processing file',
      filePath,
      extension: ext,
      hospitalId,
      fileId,
      jobId: job.id,
    });

    switch (ext) {
      case '.csv':
        return this.processCSVFile(filePath, hospitalId, fileId, job);
      case '.xlsx':
      case '.xls':
        return this.processExcelFile(filePath, hospitalId, fileId, job);
      default:
        this.logger.warn({
          msg: 'Unsupported file type',
          filePath,
          extension: ext,
          jobId: job.id,
        });
        return 0;
    }
  }

  private async processCSVFile(filePath: string, hospitalId: string, fileId: string, job: Job): Promise<number> {
    return new Promise((resolve, reject) => {
      const records: PriceRecord[] = [];
      let totalRecords = 0;

      Papa.parse(fs.createReadStream(filePath), {
        header: true,
        skipEmptyLines: true,
        chunk: (results) => {
          // Process chunk synchronously to avoid promise issues
          this.processChunk(results, records, hospitalId, fileId)
            .catch(error => {
              this.logger.error({
                msg: 'Error processing CSV chunk',
                filePath,
                error: error.message,
                jobId: job.id,
              });
            });
        },
        complete: () => {
          // Process remaining records synchronously
          this.processRemainingRecords(records, hospitalId, fileId)
            .then(() => {
              totalRecords += records.length;
              resolve(totalRecords);
            })
            .catch(error => {
              this.logger.error({
                msg: 'Error processing remaining CSV records',
                filePath,
                error: error.message,
                jobId: job.id,
              });
              reject(error instanceof Error ? error : new Error(String(error)));
            });
        },
        error: (error) => {
          this.logger.error({
            msg: 'CSV parsing error',
            filePath,
            error: error.message,
            jobId: job.id,
          });
          reject(error);
        },
      });
    });
  }

  private async processChunk(results: any, records: PriceRecord[], hospitalId: string, fileId: string): Promise<void> {
    for (const row of results.data) {
      const record = this.normalizeRecord(row);
      if (record) {
        records.push(record);
      }
    }

    // Process in batches
    if (records.length >= 1000) {
      await this.savePriceRecords(records, hospitalId, fileId);
      records.length = 0; // Clear array
    }
  }

  private async processRemainingRecords(records: PriceRecord[], hospitalId: string, fileId: string): Promise<void> {
    if (records.length > 0) {
      await this.savePriceRecords(records, hospitalId, fileId);
    }
  }

  private async processExcelFile(filePath: string, hospitalId: string, fileId: string, job: Job): Promise<number> {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      const records: PriceRecord[] = [];
      for (const row of data) {
        const record = this.normalizeRecord(row as any);
        if (record) {
          records.push(record);
        }
      }

      await this.savePriceRecords(records, hospitalId, fileId);
      return records.length;
    } catch (error) {
      this.logger.error({
        msg: 'Excel processing error',
        filePath,
        error: error.message,
        jobId: job.id,
      });
      throw error;
    }
  }

  private normalizeRecord(row: any): PriceRecord | null {
    const record: PriceRecord = {};
    const fieldMappings = this.getFieldMappings();

    this.mapFields(row, record, fieldMappings);

    // Must have at least description or code
    if (!record.description && !record.code) {
      return null;
    }

    return record;
  }

  private getFieldMappings() {
    return {
      description: ['description', 'service_description', 'item_description', 'procedure_description'],
      code: ['code', 'procedure_code', 'cpt_code', 'hcpcs_code', 'drg_code'],
      codeType: ['code_type', 'procedure_type'],
      grossCharge: ['gross_charge', 'gross_price', 'standard_charge'],
      discountedCashPrice: ['discounted_cash_price', 'cash_price', 'self_pay_price'],
      minimumNegotiatedCharge: ['minimum_negotiated_charge', 'min_price'],
      maximumNegotiatedCharge: ['maximum_negotiated_charge', 'max_price'],
    };
  }

  private mapFields(row: any, record: PriceRecord, fieldMappings: Record<string, string[]>): void {
    for (const [targetField, sourceFields] of Object.entries(fieldMappings)) {
      const value = this.findFieldValue(row, sourceFields);
      if (value !== null) {
        record[targetField] = this.processFieldValue(targetField, value);
        break;
      }
    }
  }

  private findFieldValue(row: any, sourceFields: string[]): string | null {
    for (const sourceField of sourceFields) {
      const value = row[sourceField];
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
    return null;
  }

  private processFieldValue(targetField: string, value: any): any {
    if (targetField.includes('Charge') || targetField.includes('Price')) {
      const numValue = parseFloat(String(value).replace(/[$,]/g, ''));
      return !isNaN(numValue) ? numValue : null;
    }
    return String(value).trim();
  }

  private async savePriceRecords(records: PriceRecord[], hospitalId: string, fileId: string): Promise<void> {
    const db = this.databaseService.db;

    const priceRecords = records.map(record => ({
      hospitalId,
      fileId,
      description: record.description || null,
      code: record.code || null,
      codeType: record.codeType || null,
      grossCharge: record.grossCharge ? record.grossCharge.toString() : null,
      discountedCashPrice: record.discountedCashPrice ? record.discountedCashPrice.toString() : null,
      minimumNegotiatedCharge: record.minimumNegotiatedCharge ? record.minimumNegotiatedCharge.toString() : null,
      maximumNegotiatedCharge: record.maximumNegotiatedCharge ? record.maximumNegotiatedCharge.toString() : null,
      payerSpecificNegotiatedCharges: record.payerSpecificNegotiatedCharges ?
        JSON.stringify(record.payerSpecificNegotiatedCharges) : null,
      rawData: JSON.stringify(record),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await db.insert(prices).values(priceRecords);
  }

  private async recordFileProcessing(
    hospitalId: string,
    fileId: string,
    filename: string,
    filesuffix: string,
    size: string,
    retrieved: string,
    recordCount: number,
  ): Promise<void> {
    const db = this.databaseService.db;

    await db.insert(priceTransparencyFiles).values({
      hospitalId,
      externalFileId: fileId,
      filename,
      fileType: filesuffix,
      fileSize: parseInt(size, 10),
      lastRetrieved: new Date(retrieved),
      recordCount,
      processedAt: new Date(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: priceTransparencyFiles.externalFileId,
      set: {
        recordCount,
        processedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  private async cleanup(originalFile: string, extractedFiles: string[]): Promise<void> {
    try {
      // Remove original file
      if (fs.existsSync(originalFile)) {
        fs.unlinkSync(originalFile);
      }

      // Remove extracted files
      for (const file of extractedFiles) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      }
    } catch (error) {
      this.logger.warn({
        msg: 'Failed to cleanup files',
        originalFile,
        extractedFiles,
        error: error.message,
      });
    }
  }
}
