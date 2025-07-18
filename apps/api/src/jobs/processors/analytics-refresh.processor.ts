import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { DatabaseService } from '../../database/database.service';
import { analytics, prices, hospitals } from '../../database/schema';
import { eq, and, count, sql, desc, asc } from 'drizzle-orm';

export interface AnalyticsRefreshJobData {
  metricTypes?: string[]; // Specific metrics to refresh, if not provided, refresh all
  timeRange?: {
    start: string;
    end: string;
  };
  forceRefresh?: boolean;
  batchSize?: number;
}

@Injectable()
@Processor('analytics-refresh')
export class AnalyticsRefreshProcessor extends WorkerHost {
  constructor(
    private readonly databaseService: DatabaseService,
    @InjectPinoLogger(AnalyticsRefreshProcessor.name)
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async process(job: Job<AnalyticsRefreshJobData>): Promise<any> {
    const { metricTypes, timeRange, forceRefresh = false, batchSize = 100 } = job.data;
    
    this.logger.info({
      msg: 'Starting analytics refresh job',
      jobId: job.id,
      metricTypes,
      timeRange,
      forceRefresh,
    });

    const startTime = Date.now();
    let totalMetricsUpdated = 0;
    const results = {
      metricsUpdated: 0,
      errors: 0,
      duration: 0,
      refreshedMetrics: [] as string[],
    };

    try {
      await job.updateProgress(10);

      // Get current period for calculations
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const currentQuarter = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
      const currentYear = `${now.getFullYear()}`;

      const periods = [
        { period: currentMonth, periodType: 'month' },
        { period: currentQuarter, periodType: 'quarter' },
        { period: currentYear, periodType: 'year' },
      ];

      const allMetricTypes = metricTypes || [
        'total_hospitals',
        'total_prices', 
        'total_services',
        'avg_price_by_state',
        'avg_price_by_service',
        'hospital_count_by_state',
        'most_expensive_services',
        'least_expensive_services',
        'price_variance_by_state',
        'service_count_by_hospital',
      ];

      await job.updateProgress(20);

      for (let i = 0; i < allMetricTypes.length; i++) {
        const metricType = allMetricTypes[i];
        
        try {
          this.logger.info({
            msg: 'Processing metric type',
            metricType,
            progress: `${i + 1}/${allMetricTypes.length}`,
          });

          await this.refreshMetricType(metricType, periods, forceRefresh);
          results.refreshedMetrics.push(metricType);
          totalMetricsUpdated++;

          const progress = 20 + ((i + 1) / allMetricTypes.length) * 70;
          await job.updateProgress(Math.round(progress));

        } catch (error) {
          this.logger.error({
            msg: 'Failed to refresh metric type',
            metricType,
            error: error.message,
          });
          results.errors++;
        }
      }

      await job.updateProgress(95);

      // Clean up old analytics data (older than 2 years)
      await this.cleanupOldAnalytics();

      await job.updateProgress(100);

      results.metricsUpdated = totalMetricsUpdated;
      results.duration = Date.now() - startTime;

      this.logger.info({
        msg: 'Analytics refresh completed successfully',
        jobId: job.id,
        results,
      });

      return results;

    } catch (error) {
      this.logger.error({
        msg: 'Analytics refresh job failed',
        jobId: job.id,
        error: error.message,
        partialResults: results,
      });
      throw error;
    }
  }

  private async refreshMetricType(metricType: string, periods: Array<{period: string, periodType: string}>, forceRefresh: boolean) {
    const db = this.databaseService.db;

    for (const { period, periodType } of periods) {
      // Check if metric already exists for this period
      if (!forceRefresh) {
        const existing = await db
          .select()
          .from(analytics)
          .where(and(
            eq(analytics.metricName, metricType),
            eq(analytics.period, period),
            eq(analytics.periodType, periodType)
          ))
          .limit(1);

        if (existing.length > 0) {
          this.logger.debug({
            msg: 'Metric already exists, skipping',
            metricType,
            period,
            periodType,
          });
          continue;
        }
      }

      await this.calculateAndStoreMetric(metricType, period, periodType);
    }
  }

  private async calculateAndStoreMetric(metricType: string, period: string, periodType: string) {
    const db = this.databaseService.db;

    switch (metricType) {
      case 'total_hospitals':
        await this.calculateTotalHospitals(period, periodType);
        break;

      case 'total_prices':
        await this.calculateTotalPrices(period, periodType);
        break;

      case 'total_services':
        await this.calculateTotalServices(period, periodType);
        break;

      case 'avg_price_by_state':
        await this.calculateAvgPriceByState(period, periodType);
        break;

      case 'avg_price_by_service':
        await this.calculateAvgPriceByService(period, periodType);
        break;

      case 'hospital_count_by_state':
        await this.calculateHospitalCountByState(period, periodType);
        break;

      case 'most_expensive_services':
        await this.calculateMostExpensiveServices(period, periodType);
        break;

      case 'least_expensive_services':
        await this.calculateLeastExpensiveServices(period, periodType);
        break;

      case 'price_variance_by_state':
        await this.calculatePriceVarianceByState(period, periodType);
        break;

      case 'service_count_by_hospital':
        await this.calculateServiceCountByHospital(period, periodType);
        break;

      default:
        this.logger.warn({
          msg: 'Unknown metric type',
          metricType,
        });
    }
  }

  private async calculateTotalHospitals(period: string, periodType: string) {
    const db = this.databaseService.db;

    const [result] = await db
      .select({
        count: count(hospitals.id),
      })
      .from(hospitals)
      .where(eq(hospitals.isActive, true));

    await this.storeMetric({
      metricName: 'total_hospitals',
      metricType: 'count',
      value: result.count.toString(),
      period,
      periodType,
      sampleSize: result.count,
      sourceQuery: 'SELECT COUNT(*) FROM hospitals WHERE is_active = true',
    });
  }

  private async calculateTotalPrices(period: string, periodType: string) {
    const db = this.databaseService.db;

    const [result] = await db
      .select({
        count: count(prices.id),
      })
      .from(prices)
      .where(eq(prices.isActive, true));

    await this.storeMetric({
      metricName: 'total_prices',
      metricType: 'count',
      value: result.count.toString(),
      period,
      periodType,
      sampleSize: result.count,
      sourceQuery: 'SELECT COUNT(*) FROM prices WHERE is_active = true',
    });
  }

  private async calculateTotalServices(period: string, periodType: string) {
    const db = this.databaseService.db;

    const [result] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${prices.serviceName})`,
      })
      .from(prices)
      .where(eq(prices.isActive, true));

    await this.storeMetric({
      metricName: 'total_services',
      metricType: 'count',
      value: result.count.toString(),
      period,
      periodType,
      sampleSize: result.count,
      sourceQuery: 'SELECT COUNT(DISTINCT service_name) FROM prices WHERE is_active = true',
    });
  }

  private async calculateAvgPriceByState(period: string, periodType: string) {
    const db = this.databaseService.db;

    const results = await db
      .select({
        state: hospitals.state,
        avgPrice: sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`,
        count: count(prices.id),
      })
      .from(prices)
      .leftJoin(hospitals, eq(prices.hospitalId, hospitals.id))
      .where(and(eq(prices.isActive, true), eq(hospitals.isActive, true)))
      .groupBy(hospitals.state);

    for (const result of results) {
      await this.storeMetric({
        metricName: 'avg_price_by_state',
        metricType: 'average',
        value: Number(result.avgPrice).toFixed(4),
        state: result.state,
        period,
        periodType,
        sampleSize: result.count,
        sourceQuery: 'SELECT state, AVG(CAST(gross_charge AS DECIMAL)) FROM prices JOIN hospitals ON prices.hospital_id = hospitals.id WHERE prices.is_active = true AND hospitals.is_active = true GROUP BY state',
      });
    }
  }

  private async calculateAvgPriceByService(period: string, periodType: string) {
    const db = this.databaseService.db;

    const results = await db
      .select({
        serviceName: prices.serviceName,
        avgPrice: sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`,
        count: count(prices.id),
      })
      .from(prices)
      .where(eq(prices.isActive, true))
      .groupBy(prices.serviceName)
      .orderBy(desc(sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`))
      .limit(100); // Top 100 services

    for (const result of results) {
      await this.storeMetric({
        metricName: 'avg_price_by_service',
        metricType: 'average',
        value: Number(result.avgPrice).toFixed(4),
        serviceName: result.serviceName,
        period,
        periodType,
        sampleSize: result.count,
        sourceQuery: 'SELECT service_name, AVG(CAST(gross_charge AS DECIMAL)) FROM prices WHERE is_active = true GROUP BY service_name ORDER BY AVG(CAST(gross_charge AS DECIMAL)) DESC LIMIT 100',
      });
    }
  }

  private async calculateHospitalCountByState(period: string, periodType: string) {
    const db = this.databaseService.db;

    const results = await db
      .select({
        state: hospitals.state,
        count: count(hospitals.id),
      })
      .from(hospitals)
      .where(eq(hospitals.isActive, true))
      .groupBy(hospitals.state);

    for (const result of results) {
      await this.storeMetric({
        metricName: 'hospital_count_by_state',
        metricType: 'count',
        value: result.count.toString(),
        state: result.state,
        period,
        periodType,
        sampleSize: result.count,
        sourceQuery: 'SELECT state, COUNT(*) FROM hospitals WHERE is_active = true GROUP BY state',
      });
    }
  }

  private async calculateMostExpensiveServices(period: string, periodType: string) {
    const db = this.databaseService.db;

    const results = await db
      .select({
        serviceName: prices.serviceName,
        avgPrice: sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`,
        count: count(prices.id),
      })
      .from(prices)
      .where(eq(prices.isActive, true))
      .groupBy(prices.serviceName)
      .orderBy(desc(sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`))
      .limit(10);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      await this.storeMetric({
        metricName: 'most_expensive_services',
        metricType: 'average',
        value: Number(result.avgPrice).toFixed(4),
        serviceName: result.serviceName,
        period,
        periodType,
        sampleSize: result.count,
        metadata: JSON.stringify({ rank: i + 1 }),
        sourceQuery: 'SELECT service_name, AVG(CAST(gross_charge AS DECIMAL)) FROM prices WHERE is_active = true GROUP BY service_name ORDER BY AVG(CAST(gross_charge AS DECIMAL)) DESC LIMIT 10',
      });
    }
  }

  private async calculateLeastExpensiveServices(period: string, periodType: string) {
    const db = this.databaseService.db;

    const results = await db
      .select({
        serviceName: prices.serviceName,
        avgPrice: sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`,
        count: count(prices.id),
      })
      .from(prices)
      .where(eq(prices.isActive, true))
      .groupBy(prices.serviceName)
      .orderBy(asc(sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`))
      .limit(10);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      await this.storeMetric({
        metricName: 'least_expensive_services',
        metricType: 'average',
        value: Number(result.avgPrice).toFixed(4),
        serviceName: result.serviceName,
        period,
        periodType,
        sampleSize: result.count,
        metadata: JSON.stringify({ rank: i + 1 }),
        sourceQuery: 'SELECT service_name, AVG(CAST(gross_charge AS DECIMAL)) FROM prices WHERE is_active = true GROUP BY service_name ORDER BY AVG(CAST(gross_charge AS DECIMAL)) ASC LIMIT 10',
      });
    }
  }

  private async calculatePriceVarianceByState(period: string, periodType: string) {
    const db = this.databaseService.db;

    const results = await db
      .select({
        state: hospitals.state,
        variance: sql<number>`VARIANCE(CAST(${prices.grossCharge} AS DECIMAL))`,
        stddev: sql<number>`STDDEV(CAST(${prices.grossCharge} AS DECIMAL))`,
        count: count(prices.id),
      })
      .from(prices)
      .leftJoin(hospitals, eq(prices.hospitalId, hospitals.id))
      .where(and(eq(prices.isActive, true), eq(hospitals.isActive, true)))
      .groupBy(hospitals.state);

    for (const result of results) {
      // Store variance
      await this.storeMetric({
        metricName: 'price_variance_by_state',
        metricType: 'variance',
        value: Number(result.variance).toFixed(4),
        state: result.state,
        period,
        periodType,
        sampleSize: result.count,
        sourceQuery: 'SELECT state, VARIANCE(CAST(gross_charge AS DECIMAL)) FROM prices JOIN hospitals ON prices.hospital_id = hospitals.id WHERE prices.is_active = true AND hospitals.is_active = true GROUP BY state',
      });

      // Store standard deviation
      await this.storeMetric({
        metricName: 'price_stddev_by_state',
        metricType: 'stddev',
        value: Number(result.stddev).toFixed(4),
        state: result.state,
        period,
        periodType,
        sampleSize: result.count,
        sourceQuery: 'SELECT state, STDDEV(CAST(gross_charge AS DECIMAL)) FROM prices JOIN hospitals ON prices.hospital_id = hospitals.id WHERE prices.is_active = true AND hospitals.is_active = true GROUP BY state',
      });
    }
  }

  private async calculateServiceCountByHospital(period: string, periodType: string) {
    const db = this.databaseService.db;

    const results = await db
      .select({
        hospitalId: prices.hospitalId,
        hospitalName: hospitals.name,
        state: hospitals.state,
        serviceCount: sql<number>`COUNT(DISTINCT ${prices.serviceName})`,
        totalPrices: count(prices.id),
      })
      .from(prices)
      .leftJoin(hospitals, eq(prices.hospitalId, hospitals.id))
      .where(and(eq(prices.isActive, true), eq(hospitals.isActive, true)))
      .groupBy(prices.hospitalId, hospitals.name, hospitals.state)
      .orderBy(desc(sql<number>`COUNT(DISTINCT ${prices.serviceName})`))
      .limit(100); // Top 100 hospitals

    for (const result of results) {
      await this.storeMetric({
        metricName: 'service_count_by_hospital',
        metricType: 'count',
        value: result.serviceCount.toString(),
        hospitalId: result.hospitalId,
        state: result.state,
        period,
        periodType,
        sampleSize: result.totalPrices,
        metadata: JSON.stringify({ hospitalName: result.hospitalName }),
        sourceQuery: 'SELECT hospital_id, COUNT(DISTINCT service_name) FROM prices JOIN hospitals ON prices.hospital_id = hospitals.id WHERE prices.is_active = true AND hospitals.is_active = true GROUP BY hospital_id ORDER BY COUNT(DISTINCT service_name) DESC LIMIT 100',
      });
    }
  }

  private async storeMetric(data: {
    metricName: string;
    metricType: string;
    value: string;
    state?: string;
    city?: string;
    hospitalId?: string;
    serviceCategory?: string;
    serviceName?: string;
    period: string;
    periodType: string;
    sampleSize?: number;
    confidence?: string;
    metadata?: string;
    sourceQuery?: string;
  }) {
    const db = this.databaseService.db;

    // First, delete existing metric if it exists
    await db
      .delete(analytics)
      .where(and(
        eq(analytics.metricName, data.metricName),
        eq(analytics.period, data.period),
        eq(analytics.periodType, data.periodType),
        data.state ? eq(analytics.state, data.state) : sql`${analytics.state} IS NULL`,
        data.city ? eq(analytics.city, data.city) : sql`${analytics.city} IS NULL`,
        data.hospitalId ? eq(analytics.hospitalId, data.hospitalId) : sql`${analytics.hospitalId} IS NULL`,
        data.serviceCategory ? eq(analytics.serviceCategory, data.serviceCategory) : sql`${analytics.serviceCategory} IS NULL`,
        data.serviceName ? eq(analytics.serviceName, data.serviceName) : sql`${analytics.serviceName} IS NULL`,
      ));

    // Insert new metric
    await db.insert(analytics).values({
      metricName: data.metricName,
      metricType: data.metricType,
      value: data.value,
      state: data.state || null,
      city: data.city || null,
      hospitalId: data.hospitalId || null,
      serviceCategory: data.serviceCategory || null,
      serviceName: data.serviceName || null,
      period: data.period,
      periodType: data.periodType,
      sampleSize: data.sampleSize || null,
      confidence: data.confidence || null,
      metadata: data.metadata || null,
      sourceQuery: data.sourceQuery || null,
      dependencies: JSON.stringify(['hospitals', 'prices']),
      calculatedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  private async cleanupOldAnalytics() {
    const db = this.databaseService.db;
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const deleted = await db
      .delete(analytics)
      .where(sql`${analytics.calculatedAt} < ${twoYearsAgo.toISOString()}`);

    this.logger.info({
      msg: 'Cleaned up old analytics data',
      cutoffDate: twoYearsAgo.toISOString(),
    });
  }
}