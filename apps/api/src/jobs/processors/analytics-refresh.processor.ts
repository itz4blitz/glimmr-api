import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { Job } from 'bullmq';
import { DatabaseService } from '../../database/database.service';
import { analytics, prices, hospitals } from '../../database/schema';
import { sql, eq, and, count, avg, min, max, desc } from 'drizzle-orm';
import { QUEUE_NAMES } from '../queues/queue.config';

export interface AnalyticsRefreshJobData {
  metricTypes?: string[];
  forceRefresh?: boolean;
  reportingPeriod?: string;
}

export interface MetricCalculation {
  metricName: string;
  metricType: 'summary' | 'trend' | 'variance' | 'geographic' | 'service';
  value: number;
  state?: string;
  city?: string;
  hospitalId?: string;
  serviceName?: string;
  serviceCategory?: string;
  period: string;
  periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  confidence: number;
  sampleSize: number;
  metadata?: Record<string, any>;
  sourceQuery?: string;
}

@Injectable()
@Processor(QUEUE_NAMES.ANALYTICS_REFRESH)
export class AnalyticsRefreshProcessor extends WorkerHost {
  constructor(
    private readonly databaseService: DatabaseService,
    @InjectPinoLogger(AnalyticsRefreshProcessor.name)
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async process(job: Job<AnalyticsRefreshJobData>): Promise<void> {
    const { metricTypes = ['all'], forceRefresh = false, reportingPeriod = 'monthly' } = job.data;
    
    this.logger.info({
      msg: 'Starting analytics refresh',
      jobId: job.id,
      metricTypes,
      forceRefresh,
      reportingPeriod,
    });

    try {
      await job.updateProgress(10);
      
      const metrics: MetricCalculation[] = [];
      const db = this.databaseService.db;

      // Calculate summary metrics
      if (metricTypes.includes('all') || metricTypes.includes('summary')) {
        const summaryMetrics = await this.calculateSummaryMetrics();
        metrics.push(...summaryMetrics);
        await job.updateProgress(25);
      }

      // Calculate price variance metrics
      if (metricTypes.includes('all') || metricTypes.includes('variance')) {
        const varianceMetrics = await this.calculatePriceVarianceMetrics();
        metrics.push(...varianceMetrics);
        await job.updateProgress(40);
      }

      // Calculate geographic metrics
      if (metricTypes.includes('all') || metricTypes.includes('geographic')) {
        const geoMetrics = await this.calculateGeographicMetrics();
        metrics.push(...geoMetrics);
        await job.updateProgress(60);
      }

      // Calculate service-level metrics
      if (metricTypes.includes('all') || metricTypes.includes('service')) {
        const serviceMetrics = await this.calculateServiceMetrics();
        metrics.push(...serviceMetrics);
        await job.updateProgress(80);
      }

      // Calculate trend metrics
      if (metricTypes.includes('all') || metricTypes.includes('trend')) {
        const trendMetrics = await this.calculateTrendMetrics();
        metrics.push(...trendMetrics);
        await job.updateProgress(90);
      }

      // Store metrics in database
      if (metrics.length > 0) {
        await this.storeMetrics(metrics, forceRefresh);
      }

      await job.updateProgress(100);

      this.logger.info({
        msg: 'Analytics refresh completed',
        jobId: job.id,
        metricsCalculated: metrics.length,
      });
    } catch (error) {
      this.logger.error({
        msg: 'Analytics refresh failed',
        jobId: job.id,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  private async calculateSummaryMetrics(): Promise<MetricCalculation[]> {
    const db = this.databaseService.db;
    const metrics: MetricCalculation[] = [];
    const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Total hospitals
    const [hospitalCount] = await db
      .select({ count: count() })
      .from(hospitals)
      .where(eq(hospitals.isActive, true));

    metrics.push({
      metricName: 'total_hospitals',
      metricType: 'summary',
      value: hospitalCount.count,
      period: currentPeriod,
      periodType: 'monthly',
      confidence: 1.0,
      sampleSize: hospitalCount.count,
      sourceQuery: 'SELECT COUNT(*) FROM hospitals WHERE is_active = true',
    });

    // Total active prices
    const [priceCount] = await db
      .select({ count: count() })
      .from(prices)
      .where(eq(prices.isActive, true));

    metrics.push({
      metricName: 'total_prices',
      metricType: 'summary',
      value: priceCount.count,
      period: currentPeriod,
      periodType: 'monthly',
      confidence: 1.0,
      sampleSize: priceCount.count,
      sourceQuery: 'SELECT COUNT(*) FROM prices WHERE is_active = true',
    });

    // Average price per service
    const [avgPrice] = await db
      .select({ 
        avg: sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`,
        count: count()
      })
      .from(prices)
      .where(eq(prices.isActive, true));

    if (avgPrice.avg) {
      metrics.push({
        metricName: 'average_price',
        metricType: 'summary',
        value: Math.round(avgPrice.avg * 100) / 100,
        period: currentPeriod,
        periodType: 'monthly',
        confidence: 0.95,
        sampleSize: avgPrice.count,
        sourceQuery: 'SELECT AVG(gross_charge) FROM prices WHERE is_active = true',
      });
    }

    return metrics;
  }

  private async calculatePriceVarianceMetrics(): Promise<MetricCalculation[]> {
    const db = this.databaseService.db;
    const metrics: MetricCalculation[] = [];
    const currentPeriod = new Date().toISOString().slice(0, 7);

    // Price variance by service (coefficient of variation)
    const serviceVariance = await db
      .select({
        serviceName: prices.serviceName,
        serviceCategory: prices.category,
        avgPrice: sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`,
        stddevPrice: sql<number>`STDDEV(CAST(${prices.grossCharge} AS DECIMAL))`,
        minPrice: sql<number>`MIN(CAST(${prices.grossCharge} AS DECIMAL))`,
        maxPrice: sql<number>`MAX(CAST(${prices.grossCharge} AS DECIMAL))`,
        sampleSize: count(),
      })
      .from(prices)
      .where(eq(prices.isActive, true))
      .groupBy(prices.serviceName, prices.category)
      .having(sql`COUNT(*) >= 5`) // Only include services with sufficient data
      .orderBy(desc(sql<number>`STDDEV(CAST(${prices.grossCharge} AS DECIMAL)) / AVG(CAST(${prices.grossCharge} AS DECIMAL))`))
      .limit(50);

    for (const service of serviceVariance) {
      if (service.avgPrice && service.stddevPrice && service.avgPrice > 0) {
        const coefficientOfVariation = service.stddevPrice / service.avgPrice;
        
        metrics.push({
          metricName: 'price_coefficient_variation',
          metricType: 'variance',
          value: Math.round(coefficientOfVariation * 10000) / 10000,
          serviceName: service.serviceName,
          serviceCategory: service.serviceCategory,
          period: currentPeriod,
          periodType: 'monthly',
          confidence: Math.min(0.95, Math.max(0.7, Math.log10(service.sampleSize) / 2)),
          sampleSize: service.sampleSize,
          metadata: {
            avgPrice: service.avgPrice,
            stddevPrice: service.stddevPrice,
            minPrice: service.minPrice,
            maxPrice: service.maxPrice,
            priceRange: service.maxPrice - service.minPrice,
          },
          sourceQuery: `SELECT service variance metrics for ${service.serviceName}`,
        });
      }
    }

    return metrics;
  }

  private async calculateGeographicMetrics(): Promise<MetricCalculation[]> {
    const db = this.databaseService.db;
    const metrics: MetricCalculation[] = [];
    const currentPeriod = new Date().toISOString().slice(0, 7);

    // Average prices by state
    const stateMetrics = await db
      .select({
        state: hospitals.state,
        avgPrice: sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`,
        hospitalCount: sql<number>`COUNT(DISTINCT ${prices.hospitalId})`,
        priceCount: count(),
      })
      .from(prices)
      .leftJoin(hospitals, eq(prices.hospitalId, hospitals.id))
      .where(and(eq(prices.isActive, true), eq(hospitals.isActive, true)))
      .groupBy(hospitals.state)
      .having(sql`COUNT(*) >= 10`)
      .orderBy(desc(sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`));

    for (const state of stateMetrics) {
      if (state.avgPrice && state.state) {
        metrics.push({
          metricName: 'average_price_by_state',
          metricType: 'geographic',
          value: Math.round(state.avgPrice * 100) / 100,
          state: state.state,
          period: currentPeriod,
          periodType: 'monthly',
          confidence: Math.min(0.95, Math.max(0.8, Math.log10(state.priceCount) / 3)),
          sampleSize: state.priceCount,
          metadata: {
            hospitalCount: state.hospitalCount,
          },
          sourceQuery: `SELECT state-level price metrics for ${state.state}`,
        });
      }
    }

    return metrics;
  }

  private async calculateServiceMetrics(): Promise<MetricCalculation[]> {
    const db = this.databaseService.db;
    const metrics: MetricCalculation[] = [];
    const currentPeriod = new Date().toISOString().slice(0, 7);

    // Most expensive services
    const expensiveServices = await db
      .select({
        serviceName: prices.serviceName,
        serviceCategory: prices.category,
        avgPrice: sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`,
        medianPrice: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(${prices.grossCharge} AS DECIMAL))`,
        sampleSize: count(),
      })
      .from(prices)
      .where(eq(prices.isActive, true))
      .groupBy(prices.serviceName, prices.category)
      .having(sql`COUNT(*) >= 5`)
      .orderBy(desc(sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`))
      .limit(25);

    for (const service of expensiveServices) {
      if (service.avgPrice) {
        metrics.push({
          metricName: 'service_average_price',
          metricType: 'service',
          value: Math.round(service.avgPrice * 100) / 100,
          serviceName: service.serviceName,
          serviceCategory: service.serviceCategory,
          period: currentPeriod,
          periodType: 'monthly',
          confidence: Math.min(0.95, Math.max(0.75, Math.log10(service.sampleSize) / 2.5)),
          sampleSize: service.sampleSize,
          metadata: {
            medianPrice: service.medianPrice,
            rank: 'top_25_expensive',
          },
          sourceQuery: `SELECT service-level metrics for ${service.serviceName}`,
        });
      }
    }

    return metrics;
  }

  private async calculateTrendMetrics(): Promise<MetricCalculation[]> {
    const db = this.databaseService.db;
    const metrics: MetricCalculation[] = [];
    const currentPeriod = new Date().toISOString().slice(0, 7);

    // Price trends over last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const trendData = await db
      .select({
        month: sql<string>`DATE_TRUNC('month', ${prices.lastUpdated})::text`,
        avgPrice: sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`,
        priceCount: count(),
      })
      .from(prices)
      .where(and(
        eq(prices.isActive, true),
        sql`${prices.lastUpdated} >= ${sixMonthsAgo.toISOString()}`
      ))
      .groupBy(sql`DATE_TRUNC('month', ${prices.lastUpdated})`)
      .orderBy(sql`DATE_TRUNC('month', ${prices.lastUpdated})`);

    if (trendData.length >= 2) {
      const firstMonth = trendData[0];
      const lastMonth = trendData[trendData.length - 1];
      
      if (firstMonth.avgPrice && lastMonth.avgPrice && firstMonth.avgPrice > 0) {
        const priceChangePercent = ((lastMonth.avgPrice - firstMonth.avgPrice) / firstMonth.avgPrice) * 100;
        
        metrics.push({
          metricName: 'price_trend_6_month',
          metricType: 'trend',
          value: Math.round(priceChangePercent * 100) / 100,
          period: currentPeriod,
          periodType: 'monthly',
          confidence: Math.min(0.9, Math.max(0.7, trendData.length / 6)),
          sampleSize: trendData.reduce((sum, month) => sum + month.priceCount, 0),
          metadata: {
            firstMonthPrice: firstMonth.avgPrice,
            lastMonthPrice: lastMonth.avgPrice,
            dataPoints: trendData.length,
            timeRange: '6_months',
          },
          sourceQuery: 'SELECT 6-month price trend analysis',
        });
      }
    }

    return metrics;
  }

  private async storeMetrics(metrics: MetricCalculation[], forceRefresh: boolean): Promise<void> {
    const db = this.databaseService.db;
    
    if (forceRefresh) {
      // Delete existing metrics for the current period
      const currentPeriod = new Date().toISOString().slice(0, 7);
      await db
        .delete(analytics)
        .where(eq(analytics.period, currentPeriod));
    }

    // Insert new metrics
    const analyticsRecords = metrics.map(metric => ({
      id: `${metric.metricName}_${metric.period}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metricName: metric.metricName,
      metricType: metric.metricType,
      value: metric.value.toString(),
      state: metric.state || null,
      city: metric.city || null,
      hospitalId: metric.hospitalId || null,
      serviceName: metric.serviceName || null,
      serviceCategory: metric.serviceCategory || null,
      period: metric.period,
      periodType: metric.periodType,
      confidence: metric.confidence,
      sampleSize: metric.sampleSize,
      metadata: metric.metadata ? JSON.stringify(metric.metadata) : null,
      sourceQuery: metric.sourceQuery || null,
      dependencies: null,
      calculatedAt: new Date(),
    }));

    // Insert in batches to avoid overwhelming the database
    const batchSize = 100;
    for (let i = 0; i < analyticsRecords.length; i += batchSize) {
      const batch = analyticsRecords.slice(i, i + batchSize);
      await db.insert(analytics).values(batch).onConflictDoNothing();
    }

    this.logger.info({
      msg: 'Analytics metrics stored',
      totalMetrics: metrics.length,
      batchesProcessed: Math.ceil(analyticsRecords.length / batchSize),
    });
  }
}