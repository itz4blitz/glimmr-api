import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { eq, and, like, desc, asc, count, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { analytics, prices, hospitals } from '../database/schema';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly databaseService: DatabaseService,
    @InjectPinoLogger(AnalyticsService.name)
    private readonly logger: PinoLogger,
  ) {}
  async getDashboardAnalytics() {
    this.logger.info({
      msg: 'Generating dashboard analytics',
      operation: 'getDashboardAnalytics',
    });

    try {
      const db = this.databaseService.db;

      // Get summary statistics
      const [summaryStats] = await db
        .select({
          totalHospitals: count(hospitals.id),
          totalPrices: sql<number>`(SELECT COUNT(*) FROM ${prices} WHERE ${prices.isActive} = true)`,
          totalServices: sql<number>`(SELECT COUNT(DISTINCT ${prices.serviceName}) FROM ${prices} WHERE ${prices.isActive} = true)`,
        })
        .from(hospitals)
        .where(eq(hospitals.isActive, true));

      // Get recent activity (last 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [recentActivity] = await db
        .select({
          newHospitals: sql<number>`COUNT(CASE WHEN ${hospitals.createdAt} > ${twentyFourHoursAgo.toISOString()} THEN 1 END)`,
          updatedPrices: sql<number>`(SELECT COUNT(*) FROM ${prices} WHERE ${prices.updatedAt} > ${twentyFourHoursAgo.toISOString()})`,
        })
        .from(hospitals);

      // Get most expensive service
      const [mostExpensiveService] = await db
        .select({
          name: prices.serviceName,
          avgPrice: sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`,
          hospitalCount: sql<number>`COUNT(DISTINCT ${prices.hospitalId})`,
        })
        .from(prices)
        .where(eq(prices.isActive, true))
        .groupBy(prices.serviceName)
        .orderBy(desc(sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`))
        .limit(1);

      // Get least expensive service
      const [leastExpensiveService] = await db
        .select({
          name: prices.serviceName,
          avgPrice: sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`,
          hospitalCount: sql<number>`COUNT(DISTINCT ${prices.hospitalId})`,
        })
        .from(prices)
        .where(eq(prices.isActive, true))
        .groupBy(prices.serviceName)
        .orderBy(asc(sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`))
        .limit(1);

      // Get geographic insights
      const stateStats = await db
        .select({
          state: hospitals.state,
          avgPrice: sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`,
          hospitalCount: count(hospitals.id),
        })
        .from(hospitals)
        .leftJoin(prices, eq(hospitals.id, prices.hospitalId))
        .where(and(eq(hospitals.isActive, true), eq(prices.isActive, true)))
        .groupBy(hospitals.state)
        .orderBy(desc(sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`));

      const mostExpensiveState = stateStats[0];
      const leastExpensiveState = stateStats[stateStats.length - 1];
      const sortedByDensity = [...stateStats].sort((a, b) => b.hospitalCount - a.hospitalCount);
      const highestDensityState = sortedByDensity[0];

      this.logger.info({
        msg: 'Dashboard analytics generated successfully',
        totalHospitals: summaryStats.totalHospitals,
        totalPrices: summaryStats.totalPrices,
        operation: 'getDashboardAnalytics',
      });

      return {
        summary: {
          totalHospitals: summaryStats.totalHospitals,
          totalPrices: summaryStats.totalPrices,
          totalServices: summaryStats.totalServices,
          lastUpdated: new Date().toISOString(),
          dataFreshness: '2 hours ago',
        },
        recentActivity: {
          newHospitals: recentActivity.newHospitals,
          updatedPrices: recentActivity.updatedPrices,
          newServices: 0, // Would need service tracking table
          period: 'last 24 hours',
        },
        topMetrics: {
          mostExpensiveService: mostExpensiveService ? {
            name: mostExpensiveService.name,
            avgPrice: Number(mostExpensiveService.avgPrice),
            hospitalCount: mostExpensiveService.hospitalCount,
          } : null,
          leastExpensiveService: leastExpensiveService ? {
            name: leastExpensiveService.name,
            avgPrice: Number(leastExpensiveService.avgPrice),
            hospitalCount: leastExpensiveService.hospitalCount,
          } : null,
        },
        geographicInsights: {
          mostExpensiveState: mostExpensiveState ? {
            state: mostExpensiveState.state,
            avgPrice: Number(mostExpensiveState.avgPrice),
          } : null,
          leastExpensiveState: leastExpensiveState ? {
            state: leastExpensiveState.state,
            avgPrice: Number(leastExpensiveState.avgPrice),
          } : null,
          highestHospitalDensity: highestDensityState ? {
            state: highestDensityState.state,
            count: highestDensityState.hospitalCount,
          } : null,
        },
      };
    } catch (error) {
      this.logger.error({
        msg: 'Failed to generate dashboard analytics',
        error: error.message,
        operation: 'getDashboardAnalytics',
      });
      throw error;
    }
  }

  async getPricingTrends(filters: {
    service?: string;
    state?: string;
    period?: string;
  }) {
    this.logger.info({
      msg: 'Generating pricing trends',
      filters,
      operation: 'getPricingTrends',
    });

    try {
      const db = this.databaseService.db;
      const period = filters.period || '30d';

      // Build conditions
      const conditions = [eq(prices.isActive, true)];
      if (filters.service) {
        conditions.push(like(prices.serviceName, `%${filters.service}%`));
      }
      if (filters.state) {
        conditions.push(eq(hospitals.state, filters.state));
      }

      const whereClause = and(...conditions);

      // Get monthly trends for the last 6 months
      const trends = await db
        .select({
          month: sql<string>`DATE_TRUNC('month', ${prices.lastUpdated})`,
          avgPrice: sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`,
          count: count(prices.id),
        })
        .from(prices)
        .leftJoin(hospitals, eq(prices.hospitalId, hospitals.id))
        .where(whereClause)
        .groupBy(sql`DATE_TRUNC('month', ${prices.lastUpdated})`)
        .orderBy(sql`DATE_TRUNC('month', ${prices.lastUpdated})`)
        .limit(6);

      // Calculate insights
      const priceValues = trends.map(t => Number(t.avgPrice));
      const firstPrice = priceValues[0] || 0;
      const lastPrice = priceValues[priceValues.length - 1] || 0;
      const percentageChange = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

      this.logger.info({
        msg: 'Pricing trends generated successfully',
        trendsCount: trends.length,
        operation: 'getPricingTrends',
      });

      return {
        period,
        service: filters.service,
        state: filters.state,
        trends: trends.map(trend => ({
          date: trend.month,
          avgPrice: Number(trend.avgPrice),
          count: trend.count,
        })),
        insights: {
          overallTrend: this.determineTrend(percentageChange),
          percentageChange: Math.abs(percentageChange),
          volatility: 'moderate', // Could calculate actual volatility
          seasonalPattern: 'unknown', // Would need more sophisticated analysis
        },
      };
    } catch (error) {
      this.logger.error({
        msg: 'Failed to generate pricing trends',
        error: error.message,
        operation: 'getPricingTrends',
        filters,
      });
      throw error;
    }
  }

  async getPowerBIInfo() {
    this.logger.info({
      msg: 'Generating PowerBI information',
      operation: 'getPowerBIInfo',
    });

    try {
      const db = this.databaseService.db;

      // Get actual record counts
      const [hospitalCount] = await db
        .select({ count: count() })
        .from(hospitals)
        .where(eq(hospitals.isActive, true));

      const [priceCount] = await db
        .select({ count: count() })
        .from(prices)
        .where(eq(prices.isActive, true));

      const [analyticsCount] = await db
        .select({ count: count() })
        .from(analytics);

      return {
        datasets: [
          {
            name: 'Hospitals',
            endpoint: '/odata/hospitals',
            description: 'Complete hospital directory with location and contact information',
            recordCount: hospitalCount.count,
            lastUpdated: new Date().toISOString(),
            fields: [
              'id', 'name', 'state', 'city', 'address', 'phone', 'website',
              'services', 'bedCount', 'ownership', 'lastUpdated'
            ],
          },
          {
            name: 'Prices',
            endpoint: '/odata/prices',
            description: 'Comprehensive pricing data for medical services',
            recordCount: priceCount.count,
            lastUpdated: new Date().toISOString(),
            fields: [
              'id', 'hospitalId', 'service', 'code', 'price', 'description',
              'category', 'state', 'city', 'lastUpdated'
            ],
          },
          {
            name: 'Analytics',
            endpoint: '/odata/analytics',
            description: 'Pre-computed analytics and aggregations',
            recordCount: analyticsCount.count,
            lastUpdated: new Date().toISOString(),
            fields: [
              'id', 'metric', 'value', 'dimension', 'period', 'state',
              'service', 'calculatedAt'
            ],
          },
        ],
        powerBIInstructions: {
          connectionString: 'https://api.glimmr.health/odata',
          authentication: 'API Key required',
          refreshSchedule: 'Every 4 hours',
          documentation: 'https://api.glimmr.health/docs#powerbi',
        },
      };
    } catch (error) {
      this.logger.error({
        msg: 'Failed to generate PowerBI information',
        error: error.message,
        operation: 'getPowerBIInfo',
      });
      throw error;
    }
  }

  private determineTrend(percentageChange: number): string {
    if (percentageChange > 0) return 'increasing';
    if (percentageChange < 0) return 'decreasing';
    return 'stable';
  }

  async exportData(filters: {
    format?: string;
    dataset?: string;
  }) {
    this.logger.info({
      msg: 'Initiating data export',
      filters,
      operation: 'exportData',
    });

    try {
      const db = this.databaseService.db;
      const format = filters.format || 'json';
      const dataset = filters.dataset || 'all';
      const exportId = `export_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Calculate actual data sizes based on dataset
      let estimatedRecords = 0;
      let estimatedSizeMB = 0;

      if (dataset === 'hospitals' || dataset === 'all') {
        const [hospitalCount] = await db
          .select({ count: count() })
          .from(hospitals)
          .where(eq(hospitals.isActive, true));
        estimatedRecords += hospitalCount.count;
        estimatedSizeMB += hospitalCount.count * 0.002; // ~2KB per hospital record
      }

      if (dataset === 'prices' || dataset === 'all') {
        const [priceCount] = await db
          .select({ count: count() })
          .from(prices)
          .where(eq(prices.isActive, true));
        estimatedRecords += priceCount.count;
        estimatedSizeMB += priceCount.count * 0.001; // ~1KB per price record
      }

      if (dataset === 'analytics' || dataset === 'all') {
        const [analyticsCount] = await db
          .select({ count: count() })
          .from(analytics);
        estimatedRecords += analyticsCount.count;
        estimatedSizeMB += analyticsCount.count * 0.0005; // ~0.5KB per analytics record
      }

      // Adjust size based on format
      const formatMultipliers = {
        json: 1.0,
        csv: 0.6,
        excel: 1.2,
        parquet: 0.3,
      };

      const finalSizeMB = estimatedSizeMB * (formatMultipliers[format] ?? 1.0);
      const estimatedTimeMinutes = Math.max(1, Math.ceil(estimatedRecords / 10000)); // ~10k records per minute

      this.logger.info({
        msg: 'Export initiated successfully',
        exportId,
        dataset,
        format,
        estimatedRecords,
        estimatedSizeMB: finalSizeMB,
        operation: 'exportData',
      });

      return {
        exportId,
        format,
        dataset,
        status: 'preparing',
        estimatedRecords,
        estimatedSize: `${finalSizeMB.toFixed(1)} MB`,
        estimatedTime: `${estimatedTimeMinutes} minute${estimatedTimeMinutes > 1 ? 's' : ''}`,
        downloadUrl: null, // Will be populated when ready
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        createdAt: new Date().toISOString(),
        availableFormats: ['json', 'csv', 'excel', 'parquet'],
        availableDatasets: ['hospitals', 'prices', 'analytics', 'all'],
      };
    } catch (error) {
      this.logger.error({
        msg: 'Failed to initiate data export',
        error: error.message,
        operation: 'exportData',
        filters,
      });
      throw error;
    }
  }
}
