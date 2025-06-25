import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { Job } from 'bullmq';
import { DatabaseService } from '../../database/database.service.js';
import { hospitals } from '../../database/schema/index.js';
import { eq } from 'drizzle-orm';
import { QUEUE_NAMES } from '../queues/queue.config.js';
import { PatientRightsAdvocateService, type PRAHospital } from '../../external-apis/patient-rights-advocate.service.js';

export interface HospitalImportJobData {
  state?: string;
  forceRefresh?: boolean;
  batchSize?: number;
}

// Use PRAHospital from the service instead of defining our own interface

@Injectable()
@Processor(QUEUE_NAMES.HOSPITAL_IMPORT)
export class HospitalImportProcessor extends WorkerHost {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly patientRightsAdvocateService: PatientRightsAdvocateService,
    @InjectPinoLogger(HospitalImportProcessor.name)
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async process(job: Job<HospitalImportJobData>): Promise<any> {
    const { state, forceRefresh = false, batchSize = 50 } = job.data;

    this.logger.info({
      msg: 'Starting hospital import from Patient Rights Advocate',
      jobId: job.id,
      state,
      forceRefresh,
      batchSize,
    });

    try {
      await job.updateProgress(0);

      // Fetch hospitals from Patient Rights Advocate API
      const hospitals = await this.fetchHospitalsFromAPI(state, job);

      await job.updateProgress(30);

      // Process and import hospitals
      const result = await this.processHospitals(hospitals, { forceRefresh, batchSize, job });

      await job.updateProgress(100);

      this.logger.info({
        msg: 'Hospital import completed successfully',
        jobId: job.id,
        result,
      });

      return result;
    } catch (error) {
      this.logger.error({
        msg: 'Hospital import job failed',
        jobId: job.id,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  private async fetchHospitalsFromAPI(state?: string, job?: Job): Promise<PRAHospital[]> {
    if (state) {
      // Fetch specific state
      this.logger.info({
        msg: 'Fetching hospitals for specific state',
        state,
        jobId: job?.id,
      });
      return await this.patientRightsAdvocateService.getHospitalsByState(state);
    } else {
      // Fetch all states
      this.logger.info({
        msg: 'Fetching hospitals for all states',
        jobId: job?.id,
      });
      return await this.patientRightsAdvocateService.getAllHospitals();
    }
  }



  private async processHospitals(
    hospitalData: PRAHospital[],
    options: { forceRefresh: boolean; batchSize: number; job: Job },
  ): Promise<any> {
    const { batchSize, job } = options;
    const stats = { processed: 0, inserted: 0, updated: 0, skipped: 0, failed: 0 };

    for (let i = 0; i < hospitalData.length; i += batchSize) {
      const batch = hospitalData.slice(i, i + batchSize);
      await this.processBatch(batch, options, stats);
      await this.updateBatchProgress(job, stats.processed, hospitalData.length, batch.length);
    }

    return this.buildProcessingResult(hospitalData.length, stats);
  }

  private async processBatch(
    batch: PRAHospital[],
    options: { forceRefresh: boolean; job: Job },
    stats: { processed: number; inserted: number; updated: number; skipped: number; failed: number }
  ): Promise<void> {
    for (const hospitalInfo of batch) {
      try {
        const result = await this.processIndividualHospital(hospitalInfo, options.forceRefresh);
        this.updateStats(stats, result);
        stats.processed++;
      } catch (error) {
        this.logHospitalError(hospitalInfo, error, options.job.id);
        stats.failed++;
      }
    }
  }

  private async processIndividualHospital(
    hospitalInfo: PRAHospital,
    forceRefresh: boolean
  ): Promise<'inserted' | 'updated' | 'skipped'> {
    const db = this.databaseService.db;

    const existing = await db
      .select()
      .from(hospitals)
      .where(eq(hospitals.externalId, hospitalInfo.id))
      .limit(1);

    const hospitalRecord = this.buildHospitalRecord(hospitalInfo);

    if (existing.length === 0) {
      await db.insert(hospitals).values({
        ...hospitalRecord,
        createdAt: new Date(),
      });
      return 'inserted';
    }

    if (forceRefresh || this.shouldUpdateHospital(existing[0], hospitalInfo)) {
      await db
        .update(hospitals)
        .set(hospitalRecord)
        .where(eq(hospitals.id, existing[0].id));
      return 'updated';
    }

    return 'skipped';
  }

  private buildHospitalRecord(hospitalInfo: PRAHospital) {
    return {
      externalId: hospitalInfo.id,
      name: hospitalInfo.name,
      address: hospitalInfo.address,
      city: hospitalInfo.city,
      state: hospitalInfo.state,
      zipCode: hospitalInfo.zip,
      phone: hospitalInfo.phone,
      website: hospitalInfo.url,
      bedCount: hospitalInfo.beds ? parseInt(hospitalInfo.beds, 10) : null,
      latitude: hospitalInfo.lat ? hospitalInfo.lat : null,
      longitude: hospitalInfo.long ? hospitalInfo.long : null,
      ccn: hospitalInfo.ccn,
      priceTransparencyFiles: JSON.stringify(hospitalInfo.files),
      lastFileCheck: new Date(),
      dataSource: 'patient_rights_advocate',
      isActive: true,
      updatedAt: new Date(),
    };
  }

  private updateStats(
    stats: { inserted: number; updated: number; skipped: number },
    result: 'inserted' | 'updated' | 'skipped'
  ): void {
    stats[result]++;
  }

  private logHospitalError(hospitalInfo: PRAHospital, error: Error, jobId: string): void {
    this.logger.warn({
      msg: 'Failed to process hospital',
      hospital: hospitalInfo.name,
      hospitalId: hospitalInfo.id,
      error: error.message,
      jobId,
    });
  }

  private async updateBatchProgress(
    job: Job,
    processed: number,
    totalCount: number,
    batchSize: number
  ): Promise<void> {
    const progress = 30 + (processed / totalCount) * 70;
    await job.updateProgress(progress);

    this.logger.debug({
      msg: 'Processed batch',
      batchSize,
      totalProcessed: processed,
      totalCount,
      progress,
      jobId: job.id,
    });
  }

  private buildProcessingResult(
    totalRecords: number,
    stats: { processed: number; inserted: number; updated: number; skipped: number; failed: number }
  ) {
    return {
      totalRecords,
      processed: stats.processed,
      inserted: stats.inserted,
      updated: stats.updated,
      skipped: stats.skipped,
      failed: stats.failed,
      successRate: stats.processed > 0 ? ((stats.inserted + stats.updated + stats.skipped) / stats.processed) * 100 : 0,
    };
  }

  private shouldUpdateHospital(existing: any, newData: PRAHospital): boolean {
    // Check if files have been updated
    const existingFiles = existing.priceTransparencyFiles ?
      JSON.parse(existing.priceTransparencyFiles) : [];

    if (existingFiles.length !== newData.files.length) {
      return true;
    }

    // Check if any file has been updated
    for (const newFile of newData.files) {
      const existingFile = existingFiles.find((f: any) => f.fileid === newFile.fileid);
      if (!existingFile || existingFile.retrieved !== newFile.retrieved) {
        return true;
      }
    }

    // Check if basic info has changed
    return (
      existing.name !== newData.name ||
      existing.address !== newData.address ||
      existing.phone !== newData.phone ||
      existing.website !== newData.url
    );
  }
}
