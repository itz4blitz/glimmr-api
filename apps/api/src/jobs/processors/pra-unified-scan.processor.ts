import { Processor, WorkerHost, InjectQueue } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { QUEUE_NAMES } from "../queues/queue.config";
import { PatientRightsAdvocateService } from "../../external-apis/patient-rights-advocate.service";
import { DatabaseService } from "../../database/database.service";
import {
  priceTransparencyFiles,
  hospitals,
  jobs,
  jobLogs,
} from "../../database/schema";
import { eq } from "drizzle-orm";

export interface PRAUnifiedScanJobData {
  forceRefresh?: boolean;
  testMode?: boolean;
  states?: string[];
}

@Injectable()
@Processor(QUEUE_NAMES.PRA_UNIFIED_SCAN)
export class PRAUnifiedScanProcessor extends WorkerHost {
  private dbJobId?: string;

  constructor(
    @InjectPinoLogger(PRAUnifiedScanProcessor.name)
    private readonly logger: PinoLogger,
    private readonly praService: PatientRightsAdvocateService,
    private readonly databaseService: DatabaseService,
    @InjectQueue(QUEUE_NAMES.PRA_FILE_DOWNLOAD)
    private readonly downloadQueue: Queue,
  ) {
    super();
  }

  /**
   * Log message to database for UI visibility
   */
  private async logToDatabase(
    level: "info" | "warning" | "error" | "success",
    message: string,
    data?: unknown,
  ) {
    if (!this.dbJobId) return;

    try {
      await this.databaseService.db.insert(jobLogs).values({
        jobId: this.dbJobId,
        level: level === "success" ? "info" : level,
        message,
        data: data ? JSON.stringify(data) : null,
      });
    } catch (error) {
      this.logger.error("Failed to log to database", error);
    }
  }

  async process(job: Job<PRAUnifiedScanJobData>): Promise<{
    scannedStates: number;
    newHospitals: number;
    updatedHospitals: number;
    newFiles: number;
    updatedFiles: number;
    downloadJobsCreated: number;
    errors: string[];
    duration: number;
    completedAt: string;
  }> {
    const { forceRefresh = false, testMode = false, states = [] } = job.data;
    const startTime = Date.now();

    // Create database job record
    try {
      const [dbJob] = await this.databaseService.db
        .insert(jobs)
        .values({
          jobType: "data_import",
          jobName: job.name || "pra-unified-scan",
          description: `PRA Hospital Discovery Scan${testMode ? " (Test Mode)" : ""}`,
          queue: QUEUE_NAMES.PRA_UNIFIED_SCAN,
          status: "running",
          priority: job.opts.priority || 0,
          startedAt: new Date(),
          inputData: JSON.stringify(job.data),
          createdBy: "system",
        })
        .returning({ id: jobs.id });

      this.dbJobId = dbJob.id;
    } catch (error) {
      this.logger.error("Failed to create job record", error);
    }

    this.logger.info({
      msg: "Starting PRA unified scan",
      jobId: job.id,
      forceRefresh,
      testMode,
      states: states.length > 0 ? states : "all",
    });

    await this.logToDatabase(
      "info",
      `Starting PRA unified scan${testMode ? " in test mode" : ""}`,
      {
        forceRefresh,
        testMode,
        states: states.length > 0 ? states : "all",
      },
    );

    try {
      // Progress tracking
      let progress = 0;
      const updateProgress = (value: number, message: string) => {
        progress = value;
        job.updateProgress({ percentage: value, message });
      };

      updateProgress(5, "Fetching states from PRA API");

      // Get states to scan
      const statesToScan =
        states.length > 0
          ? states
          : testMode
            ? ["CA", "FL", "TX"] // Test mode - only 3 states
            : await this.getAvailableStates();

      updateProgress(10, `Scanning ${statesToScan.length} states`);

      await this.logToDatabase(
        "info",
        `States to scan: ${statesToScan.join(", ")}`,
        {
          totalStates: statesToScan.length,
          states: statesToScan,
        },
      );

      const results = {
        scannedStates: statesToScan.length,
        newHospitals: 0,
        updatedHospitals: 0,
        newFiles: 0,
        updatedFiles: 0,
        downloadJobsCreated: 0,
        errors: [] as string[],
      };

      // Process each state
      const stateProgressIncrement = 80 / statesToScan.length;

      for (let i = 0; i < statesToScan.length; i++) {
        const state = statesToScan[i];
        const stateProgress = 10 + i * stateProgressIncrement;

        updateProgress(
          stateProgress,
          `Processing ${state} (${i + 1}/${statesToScan.length})`,
        );

        try {
          await this.logToDatabase("info", `Processing state: ${state}`, {
            stateNumber: i + 1,
            totalStates: statesToScan.length,
            progress: stateProgress,
          });

          const stateResults = await this.processState(state, forceRefresh);

          results.newHospitals += stateResults.newHospitals;
          results.updatedHospitals += stateResults.updatedHospitals;
          results.newFiles += stateResults.newFiles;
          results.updatedFiles += stateResults.updatedFiles;
          results.downloadJobsCreated += stateResults.downloadJobsCreated;

          await this.logToDatabase(
            "success",
            `Completed ${state}: ${stateResults.newHospitals} new hospitals, ${stateResults.newFiles} new files`,
            {
              state,
              ...stateResults,
            },
          );
        } catch (error) {
          this.logger.error({
            msg: "Error processing state",
            state,
            error: (error as Error).message,
          });
          results.errors.push(`${state}: ${(error as Error).message}`);

          await this.logToDatabase(
            "error",
            `Failed to process ${state}: ${(error as Error).message}`,
            {
              state,
              error: (error as Error).message,
            },
          );
        }

        // Small delay to avoid rate limiting
        if (i < statesToScan.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Increased delay
        }

        // Extend job lock periodically
        if (job.token && i % 5 === 0) {
          try {
            await job.extendLock(job.token, 300000); // Extend by 5 minutes
          } catch (err) {
            this.logger.warn({
              msg: "Failed to extend job lock",
              error: (err as Error).message,
            });
          }
        }
      }

      updateProgress(95, "Finalizing scan results");

      const duration = Date.now() - startTime;

      // Log final summary
      await this.logToDatabase(
        "success",
        `Scan completed: ${results.newHospitals} new hospitals, ${results.newFiles} new files, ${results.downloadJobsCreated} download jobs created`,
        results,
      );

      if (results.errors.length > 0) {
        await this.logToDatabase(
          "warning",
          `Completed with ${results.errors.length} errors`,
          {
            errors: results.errors,
          },
        );
      }

      this.logger.info({
        msg: "PRA unified scan completed",
        jobId: job.id,
        duration,
        results,
      });

      // Update job record
      if (this.dbJobId) {
        await this.databaseService.db
          .update(jobs)
          .set({
            status: "completed",
            completedAt: new Date(),
            duration,
            outputData: JSON.stringify(results),
            progressPercentage: 100,
            totalSteps: statesToScan.length,
            completedSteps: statesToScan.length,
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, this.dbJobId));
      }

      updateProgress(100, "Scan completed");

      return {
        ...results,
        duration,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      await this.logToDatabase(
        "error",
        `Scan failed: ${(error as Error).message}`,
        {
          error: (error as Error).message,
          stack: (error as Error).stack,
        },
      );

      // Update job record as failed
      if (this.dbJobId) {
        await this.databaseService.db
          .update(jobs)
          .set({
            status: "failed",
            completedAt: new Date(),
            duration,
            errorMessage: (error as Error).message,
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, this.dbJobId));
      }

      this.logger.error({
        msg: "PRA unified scan failed",
        jobId: job.id,
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration,
      });
      throw error;
    }
  }

  private async getAvailableStates(): Promise<string[]> {
    // Return all US states
    return [
      "AL",
      "AK",
      "AZ",
      "AR",
      "CA",
      "CO",
      "CT",
      "DE",
      "FL",
      "GA",
      "HI",
      "ID",
      "IL",
      "IN",
      "IA",
      "KS",
      "KY",
      "LA",
      "ME",
      "MD",
      "MA",
      "MI",
      "MN",
      "MS",
      "MO",
      "MT",
      "NE",
      "NV",
      "NH",
      "NJ",
      "NM",
      "NY",
      "NC",
      "ND",
      "OH",
      "OK",
      "OR",
      "PA",
      "RI",
      "SC",
      "SD",
      "TN",
      "TX",
      "UT",
      "VT",
      "VA",
      "WA",
      "WV",
      "WI",
      "WY",
      "DC",
    ];
  }

  private async processState(
    state: string,
    forceRefresh: boolean,
  ): Promise<{
    newHospitals: number;
    updatedHospitals: number;
    newFiles: number;
    updatedFiles: number;
    downloadJobsCreated: number;
  }> {
    const results = {
      newHospitals: 0,
      updatedHospitals: 0,
      newFiles: 0,
      updatedFiles: 0,
      downloadJobsCreated: 0,
    };

    // Fetch hospitals from PRA for this state
    const praHospitals = await this.praService.getHospitalsByState(state);

    await this.logToDatabase(
      "info",
      `Found ${praHospitals.length} hospitals in ${state}`,
      {
        state,
        hospitalCount: praHospitals.length,
      },
    );

    // Get existing hospitals for this state from database
    const db = this.databaseService.db;
    const existingHospitals = await db
      .select()
      .from(hospitals)
      .where(eq(hospitals.state, state));

    const existingHospitalMap = new Map(
      existingHospitals.map((h) => [h.ccn || h.externalId || h.name, h]),
    );

    // Process each hospital
    for (const praHospital of praHospitals) {
      try {
        // Skip invalid hospital records
        if (!praHospital.name || praHospital.name.trim() === "") {
          this.logger.warn({
            msg: "Skipping hospital with no name",
            hospital: praHospital,
          });
          continue;
        }

        const hospitalKey =
          praHospital.ccn || praHospital.id || praHospital.name;
        const existingHospital = existingHospitalMap.get(hospitalKey);

        let hospitalId: string;

        if (existingHospital) {
          // Update existing hospital if data changed
          if (this.hasHospitalChanged(existingHospital, praHospital)) {
            await db
              .update(hospitals)
              .set({
                name: praHospital.name,
                address: praHospital.address,
                city: praHospital.city,
                state: praHospital.state,
                zipCode: praHospital.zip,
                phone: praHospital.phone,
                website: praHospital.url || null,
                bedCount: praHospital.beds ? parseInt(praHospital.beds) : null,
                latitude: praHospital.lat || null,
                longitude: praHospital.long || null,
                lastUpdated: new Date(),
                priceTransparencyFiles: JSON.stringify(praHospital.files || []),
                lastFileCheck: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(hospitals.id, existingHospital.id));
            results.updatedHospitals++;
          }
          hospitalId = existingHospital.id;
        } else {
          try {
            // Create new hospital
            const [newHospital] = await db
              .insert(hospitals)
              .values({
                name: praHospital.name,
                address: praHospital.address,
                city: praHospital.city,
                state: praHospital.state,
                zipCode: praHospital.zip,
                phone: praHospital.phone,
                website: praHospital.url || null,
                bedCount: praHospital.beds ? parseInt(praHospital.beds) : null,
                latitude: praHospital.lat || null,
                longitude: praHospital.long || null,
                ccn: praHospital.ccn || null,
                externalId: praHospital.id,
                dataSource: "patient_rights_advocate" as const,
                sourceUrl: praHospital.url || null,
                isActive: true,
                lastUpdated: new Date(),
                priceTransparencyFiles: JSON.stringify(praHospital.files || []),
                lastFileCheck: new Date(),
              })
              .returning();
            results.newHospitals++;
            hospitalId = newHospital.id;

            await this.logToDatabase(
              "info",
              `Added new hospital: ${praHospital.name}`,
              {
                hospitalId,
                hospitalName: praHospital.name,
                city: praHospital.city,
                state: praHospital.state,
              },
            );
          } catch (insertError) {
            this.logger.error({
              msg: "Failed to create hospital",
              hospitalName: praHospital.name,
              ccn: praHospital.ccn,
              error: insertError.message,
            });
            continue; // Skip to next hospital
          }
        }

        // Process files for this hospital
        if (praHospital.files && praHospital.files.length > 0 && hospitalId) {
          try {
            const fileResults = await this.processHospitalFiles(
              hospitalId,
              praHospital.files,
              forceRefresh,
            );

            results.newFiles += fileResults.newFiles;
            results.updatedFiles += fileResults.updatedFiles;
            results.downloadJobsCreated += fileResults.downloadJobsCreated;
          } catch (fileError) {
            this.logger.error({
              msg: "Error processing files for hospital",
              hospitalId,
              hospitalName: praHospital.name,
              error: fileError.message,
            });
            // Continue with next hospital
          }
        }
      } catch (hospitalError) {
        this.logger.error({
          msg: "Error processing hospital",
          hospitalName: praHospital.name,
          error: hospitalError.message,
        });
        // Continue with next hospital
      }
    }

    return results;
  }

  private hasHospitalChanged(
    existing: typeof hospitals.$inferSelect,
    updated: {
      name?: string;
      address?: string;
      city?: string;
      zip?: string;
      phone?: string;
      url?: string;
      ccn?: string;
      id?: string;
      state?: string;
      beds?: string;
      lat?: string | number;
      long?: string | number;
      files?: unknown[];
    },
  ): boolean {
    // Check key fields for changes
    const fieldsToCheck = [
      { existing: "name", updated: "name" },
      { existing: "address", updated: "address" },
      { existing: "city", updated: "city" },
      { existing: "zipCode", updated: "zip" },
      { existing: "phone", updated: "phone" },
      { existing: "website", updated: "url" },
    ];

    return fieldsToCheck.some(
      (field) => existing[field.existing] !== (updated[field.updated] || null),
    );
  }

  private async processHospitalFiles(
    hospitalId: string,
    files: Array<{
      fileid?: string;
      url: string;
      filename: string;
      filesuffix?: string;
      size?: string;
      retrieved?: string;
      lastModified?: string;
    }>,
    forceRefresh: boolean,
  ): Promise<{
    newFiles: number;
    updatedFiles: number;
    downloadJobsCreated: number;
  }> {
    const results = {
      newFiles: 0,
      updatedFiles: 0,
      downloadJobsCreated: 0,
    };

    const db = this.databaseService.db;

    // Get existing files for this hospital OR with the same external file ID
    const existingFiles = await db
      .select()
      .from(priceTransparencyFiles)
      .where(eq(priceTransparencyFiles.hospitalId, hospitalId));

    const existingFileMap = new Map(existingFiles.map((f) => [f.fileUrl, f]));

    // Collect all download jobs to queue after database operations
    const downloadJobs: Array<{
      hospitalId: string;
      fileId: string;
      file: {
        fileid?: string;
        url: string;
        filename: string;
        filesuffix?: string;
        size?: string;
        retrieved?: string;
        lastModified?: string;
      };
    }> = [];

    for (const file of files) {
      const existingFile = existingFileMap.get(file.url);

      if (existingFile) {
        // Check if file has been updated
        const hasChanged =
          existingFile.fileSize !== (file.size ? parseInt(file.size) : null) ||
          existingFile.lastRetrieved?.toISOString() !== file.retrieved;

        if (hasChanged || forceRefresh) {
          // Update file record
          await db
            .update(priceTransparencyFiles)
            .set({
              filename: file.filename,
              fileUrl: file.url,
              fileSize: file.size ? parseInt(file.size) : null,
              lastRetrieved: file.retrieved ? new Date(file.retrieved) : null,
              processingStatus: "pending",
              updatedAt: new Date(),
            })
            .where(eq(priceTransparencyFiles.id, existingFile.id));

          results.updatedFiles++;

          // Collect download job to queue later
          downloadJobs.push({ hospitalId, fileId: existingFile.id, file });
        }
      } else {
        try {
          // Create new file record
          const [newFile] = await db
            .insert(priceTransparencyFiles)
            .values({
              hospitalId,
              externalFileId: file.fileid || file.url,
              filename: file.filename,
              fileUrl: file.url,
              fileSize: file.size ? parseInt(file.size) : null,
              fileType: this.determineFileType(file.filename),
              lastRetrieved: file.retrieved ? new Date(file.retrieved) : null,
              processingStatus: "pending",
            })
            .returning();

          results.newFiles++;

          // Collect download job to queue later
          downloadJobs.push({ hospitalId, fileId: newFile.id, file });

          await this.logToDatabase(
            "info",
            `Created file record: ${file.filename}`,
            {
              hospitalId,
              fileId: newFile.id,
              filename: file.filename,
              fileSize: file.size,
            },
          );
        } catch (fileInsertError) {
          this.logger.error({
            msg: "Failed to insert price transparency file",
            hospitalId,
            filename: file.filename,
            fileUrl: file.url,
            error: fileInsertError.message,
          });
          // Continue with next file
        }
      }
    }

    // Queue all download jobs after database operations are complete
    // Add a small delay to ensure database commits are complete
    if (downloadJobs.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));

      for (const job of downloadJobs) {
        await this.queueFileDownload(job.hospitalId, job.fileId, job.file);
        results.downloadJobsCreated++;
      }

      await this.logToDatabase(
        "info",
        `Queued ${downloadJobs.length} download jobs`,
        {
          hospitalId,
          downloadJobsQueued: downloadJobs.length,
        },
      );
    }

    return results;
  }

  private determineFileType(filename: string): string {
    const lowerName = filename.toLowerCase();
    if (lowerName.includes("standard") || lowerName.includes("charge")) {
      return "standard_charges";
    } else if (lowerName.includes("mrf") || lowerName.includes("machine")) {
      return "machine_readable";
    }
    return "unknown";
  }

  private async queueFileDownload(
    hospitalId: string,
    fileId: string,
    fileData: {
      fileid?: string;
      url: string;
      filename: string;
      filesuffix?: string;
      size?: string;
      retrieved?: string;
      lastModified?: string;
    },
  ): Promise<void> {
    await this.downloadQueue.add(
      `download-${fileId}`,
      {
        hospitalId,
        fileId,
        fileUrl: fileData.url,
        filename: fileData.filename,
        filesuffix: fileData.filesuffix || "",
        size: fileData.size,
        retrieved: fileData.lastModified,
      },
      {
        priority: 5,
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 10000, // Increased initial delay
        },
        removeOnComplete: 10,
        removeOnFail: 30,
      },
    );
  }
}
