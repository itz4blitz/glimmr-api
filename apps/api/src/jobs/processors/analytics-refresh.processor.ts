import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { DatabaseService } from "../../database/database.service";
import { QUEUE_NAMES } from "../queues/queue.config";
import {
  prices,
  hospitals,
  analytics,
  jobs as jobsTable,
  jobLogs,
} from "../../database/schema";
import { eq, and, sql, gte as _gte, lte, SQL, AnyColumn } from "drizzle-orm";

export interface AnalyticsRefreshJobData {
  hospitalId?: string;
  fileId?: string;
  state?: string;
  triggerType: string;
  metrics: string[];
  period?: string;
}

interface MetricResult {
  metricName: string;
  records: number;
  duration: number;
}

@Injectable()
@Processor(QUEUE_NAMES.ANALYTICS_REFRESH)
export class AnalyticsRefreshProcessor extends WorkerHost {
  constructor(
    @InjectPinoLogger(AnalyticsRefreshProcessor.name)
    private readonly logger: PinoLogger,
    private readonly databaseService: DatabaseService,
  ) {
    super();
  }

  async process(job: Job<AnalyticsRefreshJobData>): Promise<MetricResult[]> {
    const { hospitalId, state, metrics, period } = job.data;
    const startTime = Date.now();
    let jobRecord: { id: string } | undefined;

    this.logger.info({
      msg: "Starting analytics refresh",
      jobId: job.id,
      hospitalId,
      state,
      metrics,
    });

    try {
      // Create job record
      const db = this.databaseService.db;
      const [newJob] = await db
        .insert(jobsTable)
        .values({
          jobType: "analytics_calculation",
          jobName: `Analytics refresh: ${hospitalId || state || "global"}`,
          description: `Refreshing analytics metrics: ${metrics.join(", ")}`,
          status: "running",
          queue: QUEUE_NAMES.ANALYTICS_REFRESH,
          priority: job.opts.priority || 0,
          startedAt: new Date(),
          inputData: JSON.stringify(job.data),
          createdBy: "system",
        })
        .returning();
      jobRecord = newJob;

      await this.logJobEvent(jobRecord.id, "info", "Job started", { metrics });
      await job.updateProgress({
        percentage: 5,
        message: "Starting analytics calculations",
      });

      const results: MetricResult[] = [];
      const progressPerMetric = 90 / metrics.length;
      let currentProgress = 5;

      // Process each requested metric
      for (const metric of metrics) {
        const metricStartTime = Date.now();

        await job.updateProgress({
          percentage: currentProgress,
          message: `Calculating ${metric}`,
        });

        try {
          let recordCount = 0;

          switch (metric) {
            case "price_statistics":
              recordCount = await this.calculatePriceStatistics(
                hospitalId,
                state,
                period,
              );
              break;
            case "service_categories":
              recordCount = await this.calculateServiceCategoryMetrics(
                hospitalId,
                state,
                period,
              );
              break;
            case "payer_rates":
              recordCount = await this.calculatePayerRateMetrics(
                hospitalId,
                state,
                period,
              );
              break;
            case "regional_averages":
              recordCount = await this.calculateRegionalAverages(state, period);
              break;
            case "hospital_rankings":
              recordCount = await this.calculateHospitalRankings(state, period);
              break;
            case "price_trends":
              recordCount = await this.calculatePriceTrends(
                hospitalId,
                state,
                period,
              );
              break;
            case "data_quality":
              recordCount = await this.calculateDataQualityMetrics(
                hospitalId,
                state,
                period,
              );
              break;
            default:
              this.logger.warn({ msg: "Unknown metric type", metric });
          }

          const metricDuration = Date.now() - metricStartTime;
          results.push({
            metricName: metric,
            records: recordCount,
            duration: metricDuration,
          });

          await this.logJobEvent(jobRecord.id, "info", `Completed ${metric}`, {
            records: recordCount,
            duration: metricDuration,
          });
        } catch (_error) {
          await this.logJobEvent(
            jobRecord.id,
            "error",
            `Failed to calculate ${metric}`,
            {
              error: (_error as Error).message,
            },
          );
          throw _error;
        }

        currentProgress += progressPerMetric;
      }

      await job.updateProgress({
        percentage: 95,
        message: "Cleaning up old analytics",
      });

      // Clean up old analytics data
      await this.cleanupOldAnalytics(hospitalId, state);

      await job.updateProgress({
        percentage: 100,
        message: "Analytics refresh completed",
      });

      const duration = Date.now() - startTime;
      const totalRecords = results.reduce((sum, r) => sum + r.records, 0);

      // Update job record
      await this.updateJobSuccess(jobRecord.id, {
        results,
        totalRecords,
        duration,
      });

      this.logger.info({
        msg: "Analytics refresh completed",
        jobId: job.id,
        totalRecords,
        duration,
      });

      return results;
    } catch (_error) {
      const duration = Date.now() - startTime;
      
      this.logger.error({
        msg: "Analytics refresh failed",
        jobId: job.id,
        error: (_error as Error).message,
        stack: (_error as Error).stack,
        duration,
      });

      if (jobRecord) {
        await this.updateJobFailure(jobRecord.id, _error, duration);
      }

      throw _error;
    }
  }

  private async calculatePriceStatistics(
    hospitalId?: string,
    state?: string,
    period?: string,
  ): Promise<number> {
    const db = this.databaseService.db;
    const calculatedAt = new Date();
    const periodValue = period || this.getCurrentPeriod();

    // Build base conditions
    const conditions = [eq(prices.isActive, true)];

    if (hospitalId) {
      conditions.push(eq(prices.hospitalId, hospitalId));
    } else if (state) {
      conditions.push(eq(hospitals.state, state));
    }

    const stats = await db
      .select({
        hospitalId: prices.hospitalId,
        category: prices.category,
        codeType: prices.codeType,
        totalPrices: sql<number>`count(*)`,
        avgGrossCharge: sql<number>`avg(gross_charge)`,
        minGrossCharge: sql<number>`min(gross_charge)`,
        maxGrossCharge: sql<number>`max(gross_charge)`,
        avgCashPrice: sql<number>`avg(discounted_cash_price)`,
        avgMinNegotiated: sql<number>`avg(minimum_negotiated_charge)`,
        avgMaxNegotiated: sql<number>`avg(maximum_negotiated_charge)`,
        pricesWithNegotiatedRates: sql<number>`count(*) filter (where has_negotiated_rates = true)`,
      })
      .from(prices)
      .innerJoin(hospitals, eq(prices.hospitalId, hospitals.id))
      .where(and(...conditions))
      .groupBy(prices.hospitalId, prices.category, prices.codeType);

    // Insert analytics records
    const analyticsRecords = [];
    for (const stat of stats) {
      // Overall price statistics
      if (stat.avgGrossCharge) {
        analyticsRecords.push({
          metricName: "avg_gross_charge",
          metricType: "price_statistic",
          value: String(stat.avgGrossCharge),
          hospitalId: stat.hospitalId,
          serviceCategory: stat.category,
          period: periodValue,
          periodType: "month" as const,
          calculatedAt,
          sampleSize: stat.totalPrices,
          metadata: JSON.stringify({ codeType: stat.codeType }),
        });
      }

      // Negotiated rate coverage
      const negotiatedCoverage =
        (stat.pricesWithNegotiatedRates / stat.totalPrices) * 100;
      analyticsRecords.push({
        metricName: "negotiated_rate_coverage",
        metricType: "data_quality",
        value: String(negotiatedCoverage),
        hospitalId: stat.hospitalId,
        serviceCategory: stat.category,
        period: periodValue,
        periodType: "month" as const,
        calculatedAt,
        sampleSize: stat.totalPrices,
      });
    }

    if (analyticsRecords.length > 0) {
      await db.insert(analytics).values(analyticsRecords);
    }

    return analyticsRecords.length;
  }

  private async calculateServiceCategoryMetrics(
    hospitalId?: string,
    state?: string,
    period?: string,
  ): Promise<number> {
    const db = this.databaseService.db;
    const calculatedAt = new Date();
    const periodValue = period || this.getCurrentPeriod();

    // Build conditions
    const conditions = [eq(prices.isActive, true)];

    if (hospitalId) {
      conditions.push(eq(prices.hospitalId, hospitalId));
    } else if (state) {
      conditions.push(eq(hospitals.state, state));
    }

    // Build select fields based on scope
    const selectFields: Record<string, SQL | SQL<number> | SQL<string> | AnyColumn> = {
      category: prices.category,
      serviceCount: sql<number>`count(distinct code)`,
      avgPrice: sql<number>`avg(gross_charge)`,
      medianPrice: sql<number>`percentile_cont(0.5) within group (order by gross_charge)`,
      priceRange: sql<number>`max(gross_charge) - min(gross_charge)`,
      totalRecords: sql<number>`count(*)`,
    };

    if (hospitalId) {
      selectFields.hospitalId = sql<string>`${hospitalId}`;
      selectFields.state = sql<string>`null`;
    } else if (state) {
      selectFields.hospitalId = sql<string>`null`;
      selectFields.state = sql<string>`${state}`;
    } else {
      selectFields.hospitalId = sql<string>`null`;
      selectFields.state = hospitals.state;
    }

    const query = db
      .select(selectFields as Record<string, SQL<unknown>>)
      .from(prices)
      .innerJoin(hospitals, eq(prices.hospitalId, hospitals.id))
      .where(and(...conditions));

    // Group by based on scope
    let categoryStats;
    if (hospitalId) {
      categoryStats = await query.groupBy(prices.category);
    } else if (state) {
      categoryStats = await query.groupBy(prices.category);
    } else {
      categoryStats = await query.groupBy(hospitals.state, prices.category);
    }

    // Insert analytics records
    const analyticsRecords = categoryStats.map((stat) => ({
      metricName: "category_avg_price",
      metricType: "category_analysis",
      value: String(stat.avgPrice || 0),
      state: typeof stat.state === "string" ? stat.state : null,
      hospitalId: hospitalId || null,
      serviceCategory: stat.category,
      period: periodValue,
      periodType: "month" as const,
      calculatedAt,
      sampleSize: stat.totalRecords,
      metadata: JSON.stringify({
        serviceCount: stat.serviceCount,
        medianPrice: stat.medianPrice,
        priceRange: stat.priceRange,
      }),
    }));

    if (analyticsRecords.length > 0) {
      await db.insert(analytics).values(analyticsRecords);
    }

    return analyticsRecords.length;
  }

  private async calculatePayerRateMetrics(
    hospitalId?: string,
    state?: string,
    period?: string,
  ): Promise<number> {
    const db = this.databaseService.db;
    const calculatedAt = new Date();
    const periodValue = period || this.getCurrentPeriod();

    // Get prices with payer rates
    const pricesConditions = [
      eq(prices.isActive, true),
      sql`${prices.payerSpecificNegotiatedCharges} is not null`,
    ];

    if (hospitalId) {
      pricesConditions.push(eq(prices.hospitalId, hospitalId));
    } else if (state) {
      pricesConditions.push(eq(hospitals.state, state));
    }

    const pricesWithRates = await db
      .select({
        hospitalId: prices.hospitalId,
        category: prices.category,
        code: prices.code,
        grossCharge: prices.grossCharge,
        cashPrice: prices.discountedCashPrice,
        payerRates: prices.payerSpecificNegotiatedCharges,
      })
      .from(prices)
      .innerJoin(hospitals, eq(prices.hospitalId, hospitals.id))
      .where(and(...pricesConditions));

    // Analyze payer rates
    const payerMetrics: Map<
      string,
      { total: number; sum: number; discounts: number[] }
    > = new Map();

    for (const price of pricesWithRates) {
      try {
        const payerRates = JSON.parse(price.payerRates || "{}");

        for (const [payerName, rateInfo] of Object.entries(payerRates)) {
          const rate = typeof rateInfo === 'object' && rateInfo !== null && 'rate' in rateInfo 
            ? (rateInfo as { rate: number }).rate 
            : rateInfo;
          if (typeof rate === "number" && rate > 0 && price.grossCharge) {
            if (!payerMetrics.has(payerName)) {
              payerMetrics.set(payerName, { total: 0, sum: 0, discounts: [] });
            }

            const metrics = payerMetrics.get(payerName)!;
            metrics.total++;
            metrics.sum += rate;

            const grossChargeNum = parseFloat(price.grossCharge || "0");
            const discount =
              grossChargeNum > 0
                ? ((grossChargeNum - rate) / grossChargeNum) * 100
                : 0;
            metrics.discounts.push(discount);
          }
        }
      } catch (_e) {
        // Skip invalid JSON
      }
    }

    // Create analytics records
    const analyticsRecords = [];
    for (const [payerName, metrics] of payerMetrics) {
      const avgRate = metrics.sum / metrics.total;
      const avgDiscount =
        metrics.discounts.reduce((a, b) => a + b, 0) / metrics.discounts.length;

      analyticsRecords.push({
        metricName: "payer_avg_negotiated_rate",
        metricType: "payer_analysis",
        value: String(avgRate),
        state: state || null,
        hospitalId: hospitalId || null,
        period: periodValue,
        periodType: "month" as const,
        calculatedAt,
        sampleSize: metrics.total,
        metadata: JSON.stringify({
          payerName,
          avgDiscount: avgDiscount.toFixed(2),
        }),
      });
    }

    if (analyticsRecords.length > 0) {
      await db.insert(analytics).values(analyticsRecords);
    }

    return analyticsRecords.length;
  }

  private async calculateRegionalAverages(
    state?: string,
    period?: string,
  ): Promise<number> {
    const db = this.databaseService.db;
    const calculatedAt = new Date();
    const periodValue = period || this.getCurrentPeriod();

    // Get top procedures by volume
    const topProcedures = await db
      .select({
        code: prices.code,
        description: sql<string>`max(${prices.description})`,
        count: sql<number>`count(*)`,
      })
      .from(prices)
      .where(eq(prices.isActive, true))
      .groupBy(prices.code)
      .orderBy(sql`count(*) desc`)
      .limit(100);

    const analyticsRecords = [];

    // Calculate regional averages for top procedures
    for (const procedure of topProcedures) {
      const regionalStats = await db
        .select({
          state: hospitals.state,
          city: hospitals.city,
          avgPrice: sql<number>`avg(${prices.grossCharge})`,
          minPrice: sql<number>`min(${prices.grossCharge})`,
          maxPrice: sql<number>`max(${prices.grossCharge})`,
          hospitalCount: sql<number>`count(distinct ${hospitals.id})`,
          priceCount: sql<number>`count(*)`,
        })
        .from(prices)
        .innerJoin(hospitals, eq(prices.hospitalId, hospitals.id))
        .where(
          and(
            eq(prices.isActive, true),
            eq(prices.code, procedure.code),
            state ? eq(hospitals.state, state) : undefined,
          ),
        )
        .groupBy(hospitals.state, hospitals.city);

      for (const stat of regionalStats) {
        if (stat.avgPrice) {
          analyticsRecords.push({
            metricName: "regional_avg_price",
            metricType: "regional_analysis",
            value: String(stat.avgPrice),
            state: stat.state,
            city: stat.city,
            serviceName: procedure.description,
            period: periodValue,
            periodType: "month" as const,
            calculatedAt,
            sampleSize: stat.priceCount,
            metadata: JSON.stringify({
              code: procedure.code,
              minPrice: stat.minPrice,
              maxPrice: stat.maxPrice,
              hospitalCount: stat.hospitalCount,
            }),
          });
        }
      }
    }

    if (analyticsRecords.length > 0) {
      await db.insert(analytics).values(analyticsRecords);
    }

    return analyticsRecords.length;
  }

  private async calculateHospitalRankings(
    state?: string,
    period?: string,
  ): Promise<number> {
    const db = this.databaseService.db;
    const calculatedAt = new Date();
    const periodValue = period || this.getCurrentPeriod();

    // Calculate hospital price indices
    const hospitalStats = await db
      .select({
        hospitalId: hospitals.id,
        hospitalName: hospitals.name,
        state: hospitals.state,
        avgPriceIndex: sql<number>`avg(${prices.grossCharge} / nullif(${prices.minimumNegotiatedCharge}, 0))`,
        totalServices: sql<number>`count(distinct ${prices.code})`,
        dataQualityScore: sql<number>`
          (count(*) filter (where ${prices.dataQuality} = 'high') * 3 +
           count(*) filter (where ${prices.dataQuality} = 'medium') * 2 +
           count(*) filter (where ${prices.dataQuality} = 'low') * 1) 
          / nullif(count(*), 0)`,
        transparencyScore: sql<number>`
          count(*) filter (where ${prices.hasNegotiatedRates} = true) * 100.0 / nullif(count(*), 0)`,
      })
      .from(hospitals)
      .innerJoin(prices, eq(hospitals.id, prices.hospitalId))
      .where(
        and(
          eq(hospitals.isActive, true),
          eq(prices.isActive, true),
          state ? eq(hospitals.state, state) : undefined,
        ),
      )
      .groupBy(hospitals.id, hospitals.name, hospitals.state);

    const analyticsRecords = hospitalStats.map((stat) => ({
      metricName: "hospital_price_index",
      metricType: "hospital_ranking",
      value: String(stat.avgPriceIndex || 0),
      hospitalId: stat.hospitalId,
      state: stat.state,
      period: periodValue,
      periodType: "month",
      calculatedAt,
      sampleSize: stat.totalServices,
      metadata: JSON.stringify({
        hospitalName: stat.hospitalName,
        dataQualityScore: stat.dataQualityScore?.toFixed(2),
        transparencyScore: stat.transparencyScore?.toFixed(2),
      }),
    }));

    if (analyticsRecords.length > 0) {
      await db.insert(analytics).values(analyticsRecords);
    }

    return analyticsRecords.length;
  }

  private async calculatePriceTrends(
    hospitalId?: string,
    state?: string,
    period?: string,
  ): Promise<number> {
    const db = this.databaseService.db;
    const calculatedAt = new Date();
    const periodValue = period || this.getCurrentPeriod();

    // For trends, we need historical data
    // This is a simplified version - in production, you'd compare with previous periods
    const trendData = await db
      .select({
        category: prices.category,
        currentAvg: sql<number>`avg(${prices.grossCharge})`,
        currentCount: sql<number>`count(*)`,
        reportingPeriod: prices.reportingPeriod,
      })
      .from(prices)
      .innerJoin(hospitals, eq(prices.hospitalId, hospitals.id))
      .where(
        and(
          eq(prices.isActive, true),
          hospitalId ? eq(prices.hospitalId, hospitalId) : undefined,
          state ? eq(hospitals.state, state) : undefined,
        ),
      )
      .groupBy(prices.category, prices.reportingPeriod);

    // For now, just store current values as trends
    const analyticsRecords = trendData
      .filter((t) => t.currentAvg)
      .map((trend) => ({
        metricName: "price_trend",
        metricType: "trend_analysis",
        value: String(trend.currentAvg),
        hospitalId: hospitalId || null,
        state: state || null,
        serviceCategory: trend.category,
        period: periodValue,
        periodType: "month",
        calculatedAt,
        sampleSize: trend.currentCount,
        metadata: JSON.stringify({
          reportingPeriod: trend.reportingPeriod,
          trendDirection: "stable", // Would calculate actual trend with historical data
          percentageChange: 0,
        }),
      }));

    if (analyticsRecords.length > 0) {
      await db.insert(analytics).values(analyticsRecords);
    }

    return analyticsRecords.length;
  }

  private async calculateDataQualityMetrics(
    hospitalId?: string,
    state?: string,
    period?: string,
  ): Promise<number> {
    const db = this.databaseService.db;
    const calculatedAt = new Date();
    const periodValue = period || this.getCurrentPeriod();

    const qualityStats = await db
      .select({
        hospitalId: hospitalId ? sql<string>`${hospitalId}` : hospitals.id,
        state: state ? sql<string>`${state}` : hospitals.state,
        totalPrices: sql<number>`count(*)`,
        highQuality: sql<number>`count(*) filter (where ${prices.dataQuality} = 'high')`,
        mediumQuality: sql<number>`count(*) filter (where ${prices.dataQuality} = 'medium')`,
        lowQuality: sql<number>`count(*) filter (where ${prices.dataQuality} = 'low')`,
        withNegotiatedRates: sql<number>`count(*) filter (where ${prices.hasNegotiatedRates} = true)`,
        withCashPrice: sql<number>`count(*) filter (where ${prices.discountedCashPrice} is not null)`,
        completeRecords: sql<number>`
          count(*) filter (where 
            ${prices.code} is not null and 
            ${prices.description} is not null and 
            ${prices.grossCharge} is not null and 
            ${prices.dataQuality} = 'high'
          )`,
      })
      .from(prices)
      .innerJoin(hospitals, eq(prices.hospitalId, hospitals.id))
      .where(
        and(
          eq(prices.isActive, true),
          hospitalId ? eq(prices.hospitalId, hospitalId) : undefined,
          state ? eq(hospitals.state, state) : undefined,
        ),
      )
      .groupBy(
        hospitalId ? sql`1` : hospitals.id,
        state ? sql`1` : hospitals.state,
      );

    const analyticsRecords = qualityStats.map((stat) => {
      const qualityScore =
        ((stat.highQuality * 3 + stat.mediumQuality * 2 + stat.lowQuality * 1) /
          (stat.totalPrices * 3)) *
        100;

      return {
        metricName: "data_quality_score",
        metricType: "data_quality",
        value: String(qualityScore),
        hospitalId:
          hospitalId ||
          (typeof stat.hospitalId === "string" ? null : stat.hospitalId),
        state: state || stat.state,
        period: periodValue,
        periodType: "month",
        calculatedAt,
        sampleSize: stat.totalPrices,
        metadata: JSON.stringify({
          highQualityPercentage: (
            (stat.highQuality / stat.totalPrices) *
            100
          ).toFixed(2),
          negotiatedRatesCoverage: (
            (stat.withNegotiatedRates / stat.totalPrices) *
            100
          ).toFixed(2),
          cashPriceCoverage: (
            (stat.withCashPrice / stat.totalPrices) *
            100
          ).toFixed(2),
          completeRecordsPercentage: (
            (stat.completeRecords / stat.totalPrices) *
            100
          ).toFixed(2),
        }),
      };
    });

    if (analyticsRecords.length > 0) {
      await db.insert(analytics).values(analyticsRecords);
    }

    return analyticsRecords.length;
  }

  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  private async cleanupOldAnalytics(
    hospitalId?: string,
    state?: string,
  ): Promise<void> {
    const db = this.databaseService.db;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Keep only the latest analytics for each metric/period combination
    await db
      .delete(analytics)
      .where(
        and(
          lte(analytics.calculatedAt, sixMonthsAgo),
          hospitalId ? eq(analytics.hospitalId, hospitalId) : undefined,
          state ? eq(analytics.state, state) : undefined,
        ),
      );
  }

  private async logJobEvent(
    jobId: string,
    level: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.databaseService.db.insert(jobLogs).values({
        jobId,
        level,
        message,
        data: data ? JSON.stringify(data) : null,
      });
    } catch (_error) {
      this.logger.error({
        msg: "Failed to log job event",
        error: (_error as Error).message,
        jobId,
        level,
        message,
      });
    }
  }

  private async updateJobSuccess(
    jobId: string,
    outputData: {
      duration?: number;
      [key: string]: unknown;
    },
  ): Promise<void> {
    const db = this.databaseService.db;
    await db
      .update(jobsTable)
      .set({
        status: "completed",
        completedAt: new Date(),
        duration: outputData.duration,
        outputData: JSON.stringify(outputData),
        progressPercentage: 100,
        recordsProcessed: outputData.totalRecords as number,
        recordsCreated: outputData.totalRecords as number,
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
