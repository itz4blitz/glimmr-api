import { Processor, WorkerHost, InjectQueue } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { DatabaseService } from "../../database/database.service";
import { QUEUE_NAMES } from "../queues/queue.config";
import {
  prices,
  hospitals,
  jobs as jobsTable,
  jobLogs,
} from "../../database/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

export interface PriceNormalizationJobData {
  hospitalId: string;
  fileId: string;
  priceIds?: string[];
  batchIndex: number;
  totalBatches: number;
}

interface NormalizedPrice {
  id: string;
  codeType: string;
  standardCode: string;
  category: string;
  dataQuality: "high" | "medium" | "low";
  hasNegotiatedRates: boolean;
  minNegotiatedCharge?: number;
  maxNegotiatedCharge?: number;
}

@Injectable()
@Processor(QUEUE_NAMES.PRICE_UPDATE)
export class PriceNormalizationProcessor extends WorkerHost {
  private readonly codePatterns = {
    CPT: /^(?:CPT:)?(\d{5})$/,
    DRG: /^(?:DRG:)?(\d{3})$/,
    HCPCS: /^(?:HCPCS:)?([A-Z]\d{4})$/,
    ICD10: /^(?:ICD-?10:)?([A-Z]\d{2}(?:\.\d+)?)$/,
    REVENUE: /^(?:REV:)?(\d{4})$/,
  };

  private readonly categoryMappings: Record<string, string[]> = {
    emergency: ["emergency", "er ", "ed ", "urgent", "trauma"],
    surgery: ["surgery", "surgical", "operation", "operative"],
    imaging: [
      "imaging",
      "radiology",
      "xray",
      "x-ray",
      "mri",
      "ct scan",
      "ultrasound",
    ],
    laboratory: ["laboratory", "lab ", "pathology", "blood", "urine"],
    pharmacy: ["pharmacy", "drug", "medication", "pharmaceutical"],
    therapy: ["therapy", "physical therapy", "pt ", "occupational", "speech"],
    maternity: ["maternity", "obstetric", "delivery", "labor", "prenatal"],
    cardiology: ["cardiac", "cardio", "heart", "coronary"],
    orthopedic: ["orthopedic", "ortho", "joint", "spine", "bone"],
    mental_health: ["mental", "psychiatric", "psych", "behavioral"],
  };

  constructor(
    @InjectPinoLogger(PriceNormalizationProcessor.name)
    private readonly logger: PinoLogger,
    private readonly databaseService: DatabaseService,
    @InjectQueue(QUEUE_NAMES.ANALYTICS_REFRESH)
    private readonly analyticsQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<PriceNormalizationJobData>): Promise<{
    success: boolean;
    processedCount: number;
    qualityBreakdown: {
      high: number;
      medium: number;
      low: number;
    };
    duration: number;
  }> {
    const { hospitalId, fileId, priceIds, batchIndex, totalBatches } = job.data;
    const startTime = Date.now();
    let jobRecord: typeof jobsTable.$inferSelect;

    this.logger.info({
      msg: "Starting price normalization",
      jobId: job.id,
      hospitalId,
      fileId,
      batchIndex,
      totalBatches,
    });

    try {
      // Create job record
      const db = this.databaseService.db;
      const [newJob] = await db
        .insert(jobsTable)
        .values({
          jobType: "price_update",
          jobName: `Normalize prices batch ${batchIndex + 1}/${totalBatches}`,
          description: `Normalizing price data for hospital ${hospitalId}`,
          status: "running",
          queue: QUEUE_NAMES.PRICE_UPDATE,
          priority: job.opts.priority || 0,
          startedAt: new Date(),
          inputData: JSON.stringify(job.data),
          createdBy: "system",
        })
        .returning();
      jobRecord = newJob;

      await this.logJobEvent(jobRecord.id, "info", "Job started", {
        batchIndex,
        totalBatches,
      });
      await job.updateProgress({
        percentage: 5,
        message: "Loading price records",
      });

      // Load prices for normalization
      let pricesToNormalize;
      if (priceIds && priceIds.length > 0) {
        pricesToNormalize = await db
          .select()
          .from(prices)
          .where(inArray(prices.id, priceIds));
      } else {
        // Load prices by fileId if no specific IDs provided
        pricesToNormalize = await db
          .select()
          .from(prices)
          .where(
            and(
              eq(prices.hospitalId, hospitalId),
              eq(prices.fileId, fileId),
              eq(prices.dataQuality, "unknown"),
            ),
          )
          .limit(1000);
      }

      await job.updateProgress({
        percentage: 20,
        message: `Processing ${pricesToNormalize.length} price records`,
      });

      const normalizedPrices: NormalizedPrice[] = [];
      let processedCount = 0;
      let highQualityCount = 0;
      let mediumQualityCount = 0;
      let lowQualityCount = 0;

      // Process each price record
      for (const price of pricesToNormalize) {
        try {
          const normalized = await this.normalizePrice(price);
          normalizedPrices.push(normalized);

          // Update price record with normalized data
          await db
            .update(prices)
            .set({
              codeType: normalized.codeType,
              code: normalized.standardCode,
              category: normalized.category,
              dataQuality: normalized.dataQuality,
              hasNegotiatedRates: normalized.hasNegotiatedRates,
              minimumNegotiatedCharge: normalized.minNegotiatedCharge
                ? String(normalized.minNegotiatedCharge)
                : null,
              maximumNegotiatedCharge: normalized.maxNegotiatedCharge
                ? String(normalized.maxNegotiatedCharge)
                : null,
              updatedAt: new Date(),
            })
            .where(eq(prices.id, price.id));

          // Track quality metrics
          switch (normalized.dataQuality) {
            case "high":
              highQualityCount++;
              break;
            case "medium":
              mediumQualityCount++;
              break;
            case "low":
              lowQualityCount++;
              break;
          }

          processedCount++;

          if (processedCount % 100 === 0) {
            const progress =
              20 + Math.round((processedCount / pricesToNormalize.length) * 60);
            await job.updateProgress({
              percentage: progress,
              message: `Normalized ${processedCount}/${pricesToNormalize.length} prices`,
            });
          }
        } catch (error) {
          await this.logJobEvent(
            jobRecord.id,
            "warn",
            "Failed to normalize price",
            {
              priceId: price.id,
              error: (error as Error).message,
            },
          );
        }
      }

      await job.updateProgress({
        percentage: 85,
        message: "Calculating statistics",
      });

      // Calculate aggregate statistics
      const stats = await this.calculateBatchStatistics(hospitalId, fileId);

      await job.updateProgress({
        percentage: 90,
        message: "Queueing analytics update",
      });

      // Queue analytics update if this is the last batch
      if (batchIndex === totalBatches - 1) {
        await this.analyticsQueue.add(
          `refresh-hospital-${hospitalId}`,
          {
            hospitalId,
            fileId,
            triggerType: "price_normalization_complete",
            metrics: ["price_statistics", "service_categories", "payer_rates"],
          },
          {
            priority: 2,
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 10000,
            },
          },
        );
      }

      await job.updateProgress({
        percentage: 100,
        message: "Normalization completed",
      });

      const duration = Date.now() - startTime;

      // Update job record
      await this.updateJobSuccess(jobRecord.id, {
        processedCount,
        highQualityCount,
        mediumQualityCount,
        lowQualityCount,
        duration,
        statistics: stats,
      });

      this.logger.info({
        msg: "Price normalization completed",
        jobId: job.id,
        processedCount,
        duration,
      });

      return {
        success: true,
        processedCount,
        qualityBreakdown: {
          high: highQualityCount,
          medium: mediumQualityCount,
          low: lowQualityCount,
        },
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error({
        msg: "Price normalization failed",
        jobId: job.id,
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration,
      });

      if (jobRecord) {
        await this.updateJobFailure(jobRecord.id, error as Error, duration);
      }

      throw error;
    }
  }

  private async normalizePrice(
    price: typeof prices.$inferSelect,
  ): Promise<NormalizedPrice> {
    const normalized: NormalizedPrice = {
      id: price.id,
      codeType: price.codeType || "unknown",
      standardCode: price.code,
      category: price.category || "other",
      dataQuality: "low",
      hasNegotiatedRates: false,
    };

    // Standardize code format
    const codeNormalization = this.normalizeCode(price.code, price.codeType);
    normalized.codeType = codeNormalization.type;
    normalized.standardCode = codeNormalization.code;

    // Categorize service
    if (!price.category || price.category === "other") {
      normalized.category = this.categorizeService(
        price.description,
        price.code,
      );
    }

    // Parse payer rates
    let payerRates: Record<
      string,
      {
        rate?: number;
        negotiatedRate?: number;
        billingClass?: string;
        methodology?: string;
      }
    > = {};
    if (price.payerSpecificNegotiatedCharges) {
      try {
        payerRates = JSON.parse(price.payerSpecificNegotiatedCharges);
        normalized.hasNegotiatedRates = Object.keys(payerRates).length > 0;
      } catch (e) {
        // Invalid JSON
      }
    }

    // Calculate min/max negotiated rates
    if (normalized.hasNegotiatedRates) {
      const rates = Object.values(payerRates)
        .map(
          (
            r:
              | {
                  rate?: number;
                  negotiatedRate?: number;
                  billingClass?: string;
                  methodology?: string;
                }
              | number,
          ) => (typeof r === "object" ? r.rate || r.negotiatedRate : r),
        )
        .filter((r): r is number => typeof r === "number" && r > 0);

      if (rates.length > 0) {
        normalized.minNegotiatedCharge = Math.min(...rates);
        normalized.maxNegotiatedCharge = Math.max(...rates);
      }
    }

    // Use explicit min/max if no payer rates
    if (!normalized.minNegotiatedCharge && price.minimumNegotiatedCharge) {
      normalized.minNegotiatedCharge = parseFloat(
        price.minimumNegotiatedCharge,
      );
    }
    if (!normalized.maxNegotiatedCharge && price.maximumNegotiatedCharge) {
      normalized.maxNegotiatedCharge = parseFloat(
        price.maximumNegotiatedCharge,
      );
    }

    // Assess data quality
    normalized.dataQuality = this.assessDataQuality(price, normalized);

    return normalized;
  }

  private normalizeCode(
    code: string,
    suggestedType?: string,
  ): { type: string; code: string } {
    if (!code) {
      return { type: "unknown", code: "UNKNOWN" };
    }

    const cleanCode = code.trim().toUpperCase();

    // Try to match known patterns
    for (const [type, pattern] of Object.entries(this.codePatterns)) {
      const match = cleanCode.match(pattern);
      if (match) {
        return { type, code: match[1] };
      }
    }

    // Use suggested type if no pattern match
    if (suggestedType && suggestedType !== "unknown") {
      return { type: suggestedType.toUpperCase(), code: cleanCode };
    }

    // Check for common prefixes
    if (cleanCode.startsWith("CPT")) {
      return { type: "CPT", code: cleanCode.replace("CPT", "").trim() };
    } else if (cleanCode.startsWith("DRG")) {
      return { type: "DRG", code: cleanCode.replace("DRG", "").trim() };
    } else if (cleanCode.startsWith("HCPCS")) {
      return { type: "HCPCS", code: cleanCode.replace("HCPCS", "").trim() };
    }

    return { type: "other", code: cleanCode };
  }

  private categorizeService(description: string, code: string): string {
    if (!description) {
      return "other";
    }

    const lowerDesc = description.toLowerCase();

    // Check category mappings
    for (const [category, keywords] of Object.entries(this.categoryMappings)) {
      if (keywords.some((keyword) => lowerDesc.includes(keyword))) {
        return category;
      }
    }

    // Check by code patterns
    if (code) {
      const codeNum = parseInt(code);
      if (!isNaN(codeNum)) {
        // CPT code ranges
        if (codeNum >= 70000 && codeNum <= 79999) return "imaging";
        if (codeNum >= 80000 && codeNum <= 89999) return "laboratory";
        if (codeNum >= 90000 && codeNum <= 99999) return "evaluation";
        if (codeNum >= 10000 && codeNum <= 69999) return "surgery";
      }
    }

    return "other";
  }

  private assessDataQuality(
    price: typeof prices.$inferSelect,
    normalized: NormalizedPrice,
  ): "high" | "medium" | "low" {
    let qualityScore = 0;
    let maxScore = 0;

    // Has valid code
    maxScore += 2;
    if (normalized.codeType !== "unknown" && normalized.codeType !== "other") {
      qualityScore += 2;
    }

    // Has description
    maxScore += 1;
    if (price.description && price.description.length > 5) {
      qualityScore += 1;
    }

    // Has gross charge
    maxScore += 2;
    if (price.grossCharge && parseFloat(price.grossCharge) > 0) {
      qualityScore += 2;
    }

    // Has negotiated rates
    maxScore += 3;
    if (normalized.hasNegotiatedRates) {
      qualityScore += 3;
    }

    // Has cash price
    maxScore += 1;
    if (
      price.discountedCashPrice &&
      parseFloat(price.discountedCashPrice) > 0
    ) {
      qualityScore += 1;
    }

    // Has proper category
    maxScore += 1;
    if (normalized.category !== "other") {
      qualityScore += 1;
    }

    const qualityPercentage = (qualityScore / maxScore) * 100;

    if (qualityPercentage >= 80) return "high";
    if (qualityPercentage >= 50) return "medium";
    return "low";
  }

  private async calculateBatchStatistics(hospitalId: string, fileId: string) {
    const db = this.databaseService.db;

    // Get basic statistics
    const stats = await db
      .select({
        totalPrices: sql<number>`count(*)`,
        avgGrossCharge: sql<number>`avg(gross_charge)`,
        minGrossCharge: sql<number>`min(gross_charge)`,
        maxGrossCharge: sql<number>`max(gross_charge)`,
        pricesWithNegotiatedRates: sql<number>`count(*) filter (where has_negotiated_rates = true)`,
        highQualityCount: sql<number>`count(*) filter (where data_quality = 'high')`,
        mediumQualityCount: sql<number>`count(*) filter (where data_quality = 'medium')`,
        lowQualityCount: sql<number>`count(*) filter (where data_quality = 'low')`,
      })
      .from(prices)
      .where(and(eq(prices.hospitalId, hospitalId), eq(prices.fileId, fileId)));

    // Get category breakdown
    const categoryStats = await db
      .select({
        category: prices.category,
        count: sql<number>`count(*)`,
        avgPrice: sql<number>`avg(gross_charge)`,
      })
      .from(prices)
      .where(and(eq(prices.hospitalId, hospitalId), eq(prices.fileId, fileId)))
      .groupBy(prices.category);

    // Get code type breakdown
    const codeTypeStats = await db
      .select({
        codeType: prices.codeType,
        count: sql<number>`count(*)`,
      })
      .from(prices)
      .where(and(eq(prices.hospitalId, hospitalId), eq(prices.fileId, fileId)))
      .groupBy(prices.codeType);

    return {
      summary: stats[0],
      byCategory: categoryStats,
      byCodeType: codeTypeStats,
    };
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
        recordsProcessed: outputData.processedCount as number,
        recordsUpdated: outputData.processedCount as number,
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

  private async updateJobFailure(
    jobId: string,
    error: Error,
    duration?: number,
  ): Promise<void> {
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
