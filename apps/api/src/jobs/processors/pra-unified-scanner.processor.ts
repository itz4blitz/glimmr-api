import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { Job, Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queues/queue.config.js';
import { HospitalsService } from '../../hospitals/hospitals.service.js';
import { PatientRightsAdvocateService, PRAHospital } from '../../external-apis/patient-rights-advocate.service.js';
import { DatabaseService } from '../../database/database.service.js';
import { hospitals } from '../../database/schema/hospitals.js';
import { eq } from 'drizzle-orm';

export interface PRAUnifiedScanJobData {
  forceRefresh?: boolean; // Force refresh even if recently updated
  testMode?: boolean; // Only scan a few states for testing
}

export interface PRAUnifiedScanJobResult {
  success: boolean;
  scannedStates: number;
  totalHospitals: number;
  newHospitals: number;
  updatedHospitals: number;
  filesQueued: number;
  errors: string[];
  duration: number;
  timestamp: string;
}

export interface FileToProcess {
  hospitalId: string;
  hospitalName: string;
  fileId: string;
  filename: string;
  fileUrl: string;
  filesuffix: string;
  size: string;
  retrieved: string;
  isNew: boolean; // true if file is new or updated
}

@Injectable()
@Processor(QUEUE_NAMES.PRA_UNIFIED_SCAN)
export class PRAUnifiedScannerProcessor extends WorkerHost {
  private readonly US_STATES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
  ];

  private readonly TEST_STATES = ['CA', 'FL', 'TX']; // For testing

  constructor(
    private readonly hospitalsService: HospitalsService,
    private readonly praService: PatientRightsAdvocateService,
    private readonly databaseService: DatabaseService,
    @InjectQueue(QUEUE_NAMES.PRA_FILE_DOWNLOAD)
    private readonly fileDownloadQueue: Queue,
    @InjectPinoLogger(PRAUnifiedScannerProcessor.name)
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async process(job: Job<PRAUnifiedScanJobData>): Promise<PRAUnifiedScanJobResult> {
    const { forceRefresh = false, testMode = false } = job.data;
    const startTime = Date.now();

    this.logger.info({
      jobId: job.id,
      forceRefresh,
      testMode,
      operation: 'pra-unified-scan',
    }, 'Starting PRA unified scan job');

    try {
      const result = await this.executeScan(job, forceRefresh, testMode, startTime);

      this.logger.info({
        jobId: job.id,
        result,
        operation: 'pra-unified-scan',
      }, 'PRA unified scan job completed');

      return result;
    } catch (error) {
      return this.handleScanError(error, startTime);
    }
  }

  private async executeScan(
    job: Job<PRAUnifiedScanJobData>,
    forceRefresh: boolean,
    testMode: boolean,
    startTime: number
  ): Promise<PRAUnifiedScanJobResult> {
    const errors: string[] = [];
    const filesToProcess: FileToProcess[] = [];
    const statesToScan = testMode ? this.TEST_STATES : this.US_STATES;
    let totalHospitals = 0;
    let newHospitals = 0;
    let updatedHospitals = 0;

    await job.updateProgress(5);

    // Scan all states
    const scanResults = await this.scanAllStates(
      job,
      statesToScan,
      forceRefresh,
      errors
    );

    totalHospitals = scanResults.totalHospitals;
    newHospitals = scanResults.newHospitals;
    updatedHospitals = scanResults.updatedHospitals;
    filesToProcess.push(...scanResults.filesToProcess);

    await job.updateProgress(80);

    // Queue file downloads
    const filesQueued = await this.queueFileDownloads(filesToProcess, errors);

    await job.updateProgress(100);

    const duration = Date.now() - startTime;
    return {
      success: errors.length === 0,
      scannedStates: statesToScan.length,
      totalHospitals,
      newHospitals,
      updatedHospitals,
      filesQueued,
      errors,
      duration,
      timestamp: new Date().toISOString(),
    };
  }

  private async scanAllStates(
    job: Job<PRAUnifiedScanJobData>,
    statesToScan: string[],
    forceRefresh: boolean,
    errors: string[]
  ) {
    let totalHospitals = 0;
    let newHospitals = 0;
    let updatedHospitals = 0;
    const filesToProcess: FileToProcess[] = [];

    for (let i = 0; i < statesToScan.length; i++) {
      const state = statesToScan[i];
      const progress = 5 + (i / statesToScan.length) * 70;

      try {
        this.logger.info({ state, progress: Math.round(progress) }, 'Scanning state');
        await job.updateProgress(Math.round(progress));

        const praHospitals = await this.praService.getHospitalsByState(state);
        totalHospitals += praHospitals.length;

        for (const praHospital of praHospitals) {
          const hospitalResult = await this.processHospital(praHospital, forceRefresh);

          if (hospitalResult.isNew) {
            newHospitals++;
          } else if (hospitalResult.wasUpdated) {
            updatedHospitals++;
          }

          filesToProcess.push(...hospitalResult.filesToProcess);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        const errorMsg = `Failed to scan state ${state}: ${error.message}`;
        errors.push(errorMsg);
        this.logger.error({ state, error: error.message }, errorMsg);
      }
    }

    return { totalHospitals, newHospitals, updatedHospitals, filesToProcess };
  }

  private async queueFileDownloads(filesToProcess: FileToProcess[], errors: string[]): Promise<number> {
    let filesQueued = 0;

    if (filesToProcess.length > 0) {
      this.logger.info({
        filesToProcess: filesToProcess.length,
      }, 'Queueing file download jobs');

      for (const file of filesToProcess) {
        try {
          await this.queueFileDownload(file);
          filesQueued++;
        } catch (error) {
          const errorMsg = `Failed to queue file download for ${file.filename}: ${error.message}`;
          errors.push(errorMsg);
          this.logger.error({ file: file.filename, error: error.message }, errorMsg);
        }
      }
    }

    return filesQueued;
  }

  private handleScanError(error: Error, startTime: number): PRAUnifiedScanJobResult {
    const duration = Date.now() - startTime;
    const errorMsg = `PRA unified scan job failed: ${error.message}`;

    this.logger.error({
      error: error.message,
      duration,
      operation: 'pra-unified-scan',
    }, errorMsg);

    return {
      success: false,
      scannedStates: 0,
      totalHospitals: 0,
      newHospitals: 0,
      updatedHospitals: 0,
      filesQueued: 0,
      errors: [errorMsg],
      duration,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Process a single hospital: upsert to database and detect file changes
   */
  private async processHospital(praHospital: PRAHospital, forceRefresh: boolean): Promise<{
    isNew: boolean;
    wasUpdated: boolean;
    filesToProcess: FileToProcess[];
  }> {
    const db = this.databaseService.db;
    const filesToProcess: FileToProcess[] = [];

    try {
      // Check if hospital exists
      const [existingHospital] = await db
        .select()
        .from(hospitals)
        .where(eq(hospitals.externalId, praHospital.id))
        .limit(1);

      const isNew = !existingHospital;
      let wasUpdated = false;

      // Upsert hospital data
      const hospitalData = {
        externalId: praHospital.id,
        name: praHospital.name,
        address: praHospital.address,
        city: praHospital.city,
        state: praHospital.state,
        zipCode: praHospital.zip,
        phone: praHospital.phone,
        website: praHospital.url,
        bedCount: praHospital.beds ? parseInt(praHospital.beds) : null,
        latitude: praHospital.lat ? praHospital.lat : null,
        longitude: praHospital.long ? praHospital.long : null,
        ccn: praHospital.ccn,
        dataSource: 'patient_rights_advocate',
        isActive: true,
        lastUpdated: new Date(),
        updatedAt: new Date(),
      };

      if (isNew) {
        // Insert new hospital
        await db.insert(hospitals).values(hospitalData);
      } else {
        // Update existing hospital
        await db
          .update(hospitals)
          .set(hospitalData)
          .where(eq(hospitals.externalId, praHospital.id));
        wasUpdated = true;
      }

      // Process files and detect changes
      if (praHospital.files && praHospital.files.length > 0) {
        for (const file of praHospital.files) {
          const shouldProcess = await this.shouldProcessFile(
            praHospital.id,
            file,
            forceRefresh,
            isNew
          );

          if (shouldProcess) {
            filesToProcess.push({
              hospitalId: praHospital.id,
              hospitalName: praHospital.name,
              fileId: file.fileid,
              filename: file.filename,
              fileUrl: file.url,
              filesuffix: file.filesuffix,
              size: file.size,
              retrieved: file.retrieved,
              isNew: isNew || await this.isFileNew(praHospital.id, file.fileid),
            });
          }
        }
      }

      return { isNew, wasUpdated, filesToProcess };

    } catch (error) {
      this.logger.error({
        hospitalId: praHospital.id,
        hospitalName: praHospital.name,
        error: error.message,
      }, 'Failed to process hospital');
      
      return { isNew: false, wasUpdated: false, filesToProcess: [] };
    }
  }

  /**
   * Determine if a file should be processed based on retrieved timestamp
   */
  private async shouldProcessFile(
    hospitalId: string,
    file: any,
    forceRefresh: boolean,
    isNewHospital: boolean
  ): Promise<boolean> {
    if (isNewHospital || forceRefresh) {
      return true;
    }

    return await this.isFileUpdated(hospitalId, file);
  }

  /**
   * Check if file is new (not in our database)
   */
  private async isFileNew(hospitalId: string, fileId: string): Promise<boolean> {
    const db = this.databaseService.db;

    try {
      const [existingFile] = await db
        .select()
        .from(hospitals)
        .where(eq(hospitals.externalId, hospitalId))
        .limit(1);

      return !existingFile;
    } catch (error) {
      this.logger.error({
        hospitalId,
        fileId,
        error: error.message,
      }, 'Failed to check if file is new');
      return true;
    }
  }

  /**
   * Check if file has been updated based on retrieved timestamp
   */
  private async isFileUpdated(hospitalId: string, file: any): Promise<boolean> {
    const db = this.databaseService.db;

    try {
      const [hospital] = await db
        .select()
        .from(hospitals)
        .where(eq(hospitals.externalId, hospitalId))
        .limit(1);

      if (!hospital?.lastUpdated) {
        return true;
      }

      const fileRetrievedDate = new Date(file.retrieved);
      const lastUpdatedDate = new Date(hospital.lastUpdated);

      return fileRetrievedDate > lastUpdatedDate;
    } catch (error) {
      this.logger.error({
        hospitalId,
        fileId: file.fileid,
        error: error.message,
      }, 'Failed to check if file is updated');
      return true;
    }
  }

  /**
   * Queue a file download job
   */
  private async queueFileDownload(file: FileToProcess): Promise<void> {
    const jobData = {
      hospitalId: file.hospitalId,
      fileId: file.fileId,
      fileUrl: file.fileUrl,
      filename: file.filename,
      filesuffix: file.filesuffix,
      size: file.size,
      retrieved: file.retrieved,
      forceReprocess: file.isNew,
    };

    await this.fileDownloadQueue.add(
      `download-${file.hospitalId}-${file.fileId}`,
      jobData,
      {
        priority: file.isNew ? 8 : 5, // Higher priority for new files
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000,
        },
        removeOnComplete: 10,
        removeOnFail: 50,
      }
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<PRAUnifiedScanJobData>, result: PRAUnifiedScanJobResult) {
    this.logger.info({
      jobId: job.id,
      result,
      operation: 'pra-unified-scan',
    }, 'PRA unified scan job completed');
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PRAUnifiedScanJobData>, error: Error) {
    this.logger.error({
      jobId: job.id,
      error: error.message,
      operation: 'pra-unified-scan',
    }, 'PRA unified scan job failed');
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn({
      jobId,
      operation: 'pra-unified-scan',
    }, 'PRA unified scan job stalled');
  }
}
