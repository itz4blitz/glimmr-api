import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { eq, and, like, gte, lte, desc, asc, count, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { prices, hospitals } from '../database/schema';

@Injectable()
export class PricesService {
  constructor(
    private readonly databaseService: DatabaseService,
    @InjectPinoLogger(PricesService.name)
    private readonly logger: PinoLogger,
  ) {}
  async getPrices(filters: {
    hospital?: string;
    service?: string;
    state?: string;
    minPrice?: number;
    maxPrice?: number;
    limit?: number;
    offset?: number;
  }) {
    this.logger.info({
      msg: 'Fetching prices with filters',
      filters,
      operation: 'getPrices',
    });

    const startTime = Date.now();

    try {
      const db = this.databaseService.db;
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      // Build where conditions
      const conditions = [eq(prices.isActive, true)];

      if (filters.hospital) {
        conditions.push(like(hospitals.name, `%${filters.hospital}%`));
      }
      if (filters.service) {
        conditions.push(like(prices.serviceName, `%${filters.service}%`));
      }
      if (filters.state) {
        conditions.push(eq(hospitals.state, filters.state));
      }
      if (filters.minPrice) {
        conditions.push(gte(prices.grossCharge, filters.minPrice.toString()));
      }
      if (filters.maxPrice) {
        conditions.push(lte(prices.grossCharge, filters.maxPrice.toString()));
      }

      const whereClause = and(...conditions);

      // Get total count
      const [totalResult] = await db
        .select({ count: count() })
        .from(prices)
        .leftJoin(hospitals, eq(prices.hospitalId, hospitals.id))
        .where(whereClause);

      // Get paginated data with hospital information
      const data = await db
        .select({
          id: prices.id,
          hospitalId: prices.hospitalId,
          hospitalName: hospitals.name,
          service: prices.serviceName,
          code: prices.serviceCode,
          price: prices.grossCharge,
          discountedCashPrice: prices.discountedCashPrice,
          description: prices.description,
          category: prices.category,
          state: hospitals.state,
          city: hospitals.city,
          lastUpdated: prices.lastUpdated,
        })
        .from(prices)
        .leftJoin(hospitals, eq(prices.hospitalId, hospitals.id))
        .where(whereClause)
        .orderBy(desc(prices.lastUpdated))
        .limit(limit)
        .offset(offset);

      const result = {
        data,
        total: totalResult.count,
        limit,
        offset,
        filters: {
          hospital: filters.hospital,
          service: filters.service,
          state: filters.state,
          priceRange: {
            min: filters.minPrice,
            max: filters.maxPrice,
          },
        },
      };

      const duration = Date.now() - startTime;
      this.logger.info({
        msg: 'Prices fetched successfully',
        count: result.data.length,
        total: result.total,
        duration,
        operation: 'getPrices',
        filters,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        msg: 'Failed to fetch prices',
        error: error.message,
        duration,
        operation: 'getPrices',
        filters,
      });
      throw error;
    }
  }

  async comparePrices(filters: {
    service: string;
    state?: string;
    limit?: number;
  }) {
    this.logger.info({
      msg: 'Comparing prices for service',
      service: filters.service,
      state: filters.state,
      operation: 'comparePrices',
    });

    try {
      const db = this.databaseService.db;
      const limit = filters.limit || 10;

      // Build where conditions
      const conditions = [
        eq(prices.isActive, true),
        like(prices.serviceName, `%${filters.service}%`)
      ];

      if (filters.state) {
        conditions.push(eq(hospitals.state, filters.state));
      }

      const whereClause = and(...conditions);

      // Get price comparison data
      const comparison = await db
        .select({
          hospitalId: prices.hospitalId,
          hospitalName: hospitals.name,
          price: prices.grossCharge,
          discountedCashPrice: prices.discountedCashPrice,
          state: hospitals.state,
          city: hospitals.city,
        })
        .from(prices)
        .leftJoin(hospitals, eq(prices.hospitalId, hospitals.id))
        .where(whereClause)
        .orderBy(asc(prices.grossCharge))
        .limit(limit);

      // Add ranking
      const rankedComparison = comparison.map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

      // Calculate analytics
      const priceValues = comparison.map(item => parseFloat(item.price || '0'));
      const sortedPrices = [...priceValues].sort((a, b) => a - b);
      const analytics = {
        averagePrice: priceValues.reduce((a, b) => a + b, 0) / priceValues.length,
        medianPrice: sortedPrices[Math.floor(sortedPrices.length / 2)],
        lowestPrice: Math.min(...priceValues),
        highestPrice: Math.max(...priceValues),
        priceVariation: priceValues.length > 1 ?
          ((Math.max(...priceValues) - Math.min(...priceValues)) / Math.min(...priceValues)) * 100 : 0,
      };

      this.logger.info({
        msg: 'Price comparison completed',
        service: filters.service,
        resultCount: comparison.length,
        operation: 'comparePrices',
      });

      return {
        service: filters.service,
        state: filters.state,
        comparison: rankedComparison,
        analytics,
      };
    } catch (error) {
      this.logger.error({
        msg: 'Failed to compare prices',
        service: filters.service,
        error: error.message,
        operation: 'comparePrices',
      });
      throw error;
    }
  }

  async getPricingAnalytics(filters: {
    service?: string;
    state?: string;
  }) {
    this.logger.info({
      msg: 'Generating pricing analytics',
      filters,
      operation: 'getPricingAnalytics',
    });

    try {
      const db = this.databaseService.db;

      // Build base conditions
      const baseConditions = [eq(prices.isActive, true)];
      if (filters.service) {
        baseConditions.push(like(prices.serviceName, `%${filters.service}%`));
      }
      if (filters.state) {
        baseConditions.push(eq(hospitals.state, filters.state));
      }

      const whereClause = and(...baseConditions);

      // Get summary statistics
      const [summaryResult] = await db
        .select({
          totalPrices: count(prices.id),
          totalHospitals: sql<number>`COUNT(DISTINCT ${prices.hospitalId})`,
          totalServices: sql<number>`COUNT(DISTINCT ${prices.serviceName})`,
        })
        .from(prices)
        .leftJoin(hospitals, eq(prices.hospitalId, hospitals.id))
        .where(whereClause);

      // Get top services by average price and count
      const topServices = await db
        .select({
          service: prices.serviceName,
          avgPrice: sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`,
          count: count(prices.id),
        })
        .from(prices)
        .leftJoin(hospitals, eq(prices.hospitalId, hospitals.id))
        .where(whereClause)
        .groupBy(prices.serviceName)
        .orderBy(desc(count(prices.id)))
        .limit(5);

      // Get state comparison (if not filtered by state)
      const stateComparison = filters.state ? [] : await db
        .select({
          state: hospitals.state,
          avgPrice: sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`,
          hospitalCount: sql<number>`COUNT(DISTINCT ${prices.hospitalId})`,
        })
        .from(prices)
        .leftJoin(hospitals, eq(prices.hospitalId, hospitals.id))
        .where(eq(prices.isActive, true))
        .groupBy(hospitals.state)
        .orderBy(desc(sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`))
        .limit(5);

      this.logger.info({
        msg: 'Pricing analytics generated successfully',
        totalPrices: summaryResult.totalPrices,
        operation: 'getPricingAnalytics',
      });

      return {
        summary: {
          totalPrices: summaryResult.totalPrices,
          totalHospitals: summaryResult.totalHospitals,
          totalServices: summaryResult.totalServices,
          lastUpdated: new Date().toISOString(),
        },
        topServices: topServices.map(service => ({
          service: service.service,
          avgPrice: Number(service.avgPrice),
          count: service.count,
        })),
        stateComparison: stateComparison.map(state => ({
          state: state.state,
          avgPrice: Number(state.avgPrice),
          hospitalCount: state.hospitalCount,
        })),
      };
    } catch (error) {
      this.logger.error({
        msg: 'Failed to generate pricing analytics',
        error: error.message,
        operation: 'getPricingAnalytics',
        filters,
      });
      throw error;
    }
  }

  async getPriceById(id: string) {
    this.logger.info({
      msg: 'Fetching price by ID',
      priceId: id,
      operation: 'getPriceById',
    });

    try {
      const db = this.databaseService.db;

      const [priceData] = await db
        .select({
          id: prices.id,
          hospitalId: prices.hospitalId,
          hospitalName: hospitals.name,
          service: prices.serviceName,
          code: prices.serviceCode,
          price: prices.grossCharge,
          discountedCashPrice: prices.discountedCashPrice,
          description: prices.description,
          category: prices.category,
          state: hospitals.state,
          city: hospitals.city,
          lastUpdated: prices.lastUpdated,
        })
        .from(prices)
        .leftJoin(hospitals, eq(prices.hospitalId, hospitals.id))
        .where(and(eq(prices.id, id), eq(prices.isActive, true)))
        .limit(1);

      if (!priceData) {
        this.logger.warn({
          msg: 'Price not found',
          priceId: id,
          operation: 'getPriceById',
        });
        return null;
      }

      this.logger.info({
        msg: 'Price fetched successfully',
        priceId: id,
        hospitalName: priceData.hospitalName,
        operation: 'getPriceById',
      });

      return priceData;
    } catch (error) {
      this.logger.error({
        msg: 'Failed to fetch price',
        priceId: id,
        error: error.message,
        operation: 'getPriceById',
      });
      throw error;
    }
  }
}
