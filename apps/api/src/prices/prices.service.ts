import { Injectable, NotFoundException } from "@nestjs/common";
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";
import {
  eq,
  and,
  like,
  gte,
  lte,
  desc,
  asc,
  count,
  sql,
  or,
  ilike,
  inArray,
} from "drizzle-orm";
import { DatabaseService } from "../database/database.service";
import { prices, hospitals, analytics } from "../database/schema";

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
      msg: "Fetching prices with filters",
      filters,
      operation: "getPrices",
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
        msg: "Prices fetched successfully",
        count: result.data.length,
        total: result.total,
        duration,
        operation: "getPrices",
        filters,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        msg: "Failed to fetch prices",
        error: error.message,
        duration,
        operation: "getPrices",
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
      msg: "Comparing prices for service",
      service: filters.service,
      state: filters.state,
      operation: "comparePrices",
    });

    try {
      const db = this.databaseService.db;
      const limit = filters.limit || 10;

      // Build where conditions
      const conditions = [
        eq(prices.isActive, true),
        like(prices.serviceName, `%${filters.service}%`),
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
      const priceValues = comparison.map((item) =>
        parseFloat(item.price || "0"),
      );
      const sortedPrices = [...priceValues].sort((a, b) => a - b);
      const analytics = {
        averagePrice:
          priceValues.reduce((a, b) => a + b, 0) / priceValues.length,
        medianPrice: sortedPrices[Math.floor(sortedPrices.length / 2)],
        lowestPrice: Math.min(...priceValues),
        highestPrice: Math.max(...priceValues),
        priceVariation:
          priceValues.length > 1
            ? ((Math.max(...priceValues) - Math.min(...priceValues)) /
                Math.min(...priceValues)) *
              100
            : 0,
      };

      this.logger.info({
        msg: "Price comparison completed",
        service: filters.service,
        resultCount: comparison.length,
        operation: "comparePrices",
      });

      return {
        service: filters.service,
        state: filters.state,
        comparison: rankedComparison,
        analytics,
      };
    } catch (error) {
      this.logger.error({
        msg: "Failed to compare prices",
        service: filters.service,
        error: error.message,
        operation: "comparePrices",
      });
      throw error;
    }
  }

  async getPricingAnalytics(filters: { service?: string; state?: string }) {
    this.logger.info({
      msg: "Generating pricing analytics",
      filters,
      operation: "getPricingAnalytics",
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
      const stateComparison = filters.state
        ? []
        : await db
            .select({
              state: hospitals.state,
              avgPrice: sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`,
              hospitalCount: sql<number>`COUNT(DISTINCT ${prices.hospitalId})`,
            })
            .from(prices)
            .leftJoin(hospitals, eq(prices.hospitalId, hospitals.id))
            .where(eq(prices.isActive, true))
            .groupBy(hospitals.state)
            .orderBy(
              desc(sql<number>`AVG(CAST(${prices.grossCharge} AS DECIMAL))`),
            )
            .limit(5);

      this.logger.info({
        msg: "Pricing analytics generated successfully",
        totalPrices: summaryResult.totalPrices,
        operation: "getPricingAnalytics",
      });

      return {
        summary: {
          totalPrices: summaryResult.totalPrices,
          totalHospitals: summaryResult.totalHospitals,
          totalServices: summaryResult.totalServices,
          lastUpdated: new Date().toISOString(),
        },
        topServices: topServices.map((service) => ({
          service: service.service,
          avgPrice: Number(service.avgPrice),
          count: service.count,
        })),
        stateComparison: stateComparison.map((state) => ({
          state: state.state,
          avgPrice: Number(state.avgPrice),
          hospitalCount: state.hospitalCount,
        })),
      };
    } catch (error) {
      this.logger.error({
        msg: "Failed to generate pricing analytics",
        error: error.message,
        operation: "getPricingAnalytics",
        filters,
      });
      throw error;
    }
  }

  async getPriceById(id: string) {
    this.logger.info({
      msg: "Fetching price by ID",
      priceId: id,
      operation: "getPriceById",
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
          msg: "Price not found",
          priceId: id,
          operation: "getPriceById",
        });
        return null;
      }

      this.logger.info({
        msg: "Price fetched successfully",
        priceId: id,
        hospitalName: priceData.hospitalName,
        operation: "getPriceById",
      });

      return priceData;
    } catch (error) {
      this.logger.error({
        msg: "Failed to fetch price",
        priceId: id,
        error: error.message,
        operation: "getPriceById",
      });
      throw error;
    }
  }

  async getHospitalPrices(
    hospitalId: string,
    params: {
      serviceCode?: string;
      serviceName?: string;
      category?: string;
      codeType?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const db = this.databaseService.db;
    const {
      serviceCode,
      serviceName,
      category,
      codeType,
      limit = 50,
      offset = 0,
    } = params;

    // Verify hospital exists
    const [hospital] = await db
      .select()
      .from(hospitals)
      .where(eq(hospitals.id, hospitalId));

    if (!hospital) {
      throw new NotFoundException(`Hospital not found: ${hospitalId}`);
    }

    // Build query
    const conditions = [
      eq(prices.hospitalId, hospitalId),
      eq(prices.isActive, true),
    ];

    if (serviceCode) {
      conditions.push(eq(prices.serviceCode, serviceCode));
    }
    if (serviceName) {
      conditions.push(ilike(prices.description, `%${serviceName}%`));
    }
    if (category) {
      conditions.push(eq(prices.category, category));
    }
    if (codeType) {
      conditions.push(eq(prices.codeType, codeType));
    }

    // Get prices
    const priceRecords = await db
      .select({
        id: prices.id,
        code: prices.serviceCode,
        codeType: prices.codeType,
        description: prices.description,
        category: prices.category,
        grossCharge: prices.grossCharge,
        discountedCashPrice: prices.discountedCashPrice,
        minNegotiatedCharge: prices.minimumNegotiatedCharge,
        maxNegotiatedCharge: prices.maximumNegotiatedCharge,
        hasNegotiatedRates: prices.hasNegotiatedRates,
        dataQuality: prices.dataQuality,
        reportingPeriod: prices.reportingPeriod,
        lastUpdated: prices.lastUpdated,
      })
      .from(prices)
      .where(and(...conditions))
      .orderBy(prices.category, prices.description)
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(prices)
      .where(and(...conditions));

    // Get summary statistics
    const [stats] = await db
      .select({
        avgGrossCharge: sql<number>`avg(gross_charge)`,
        minGrossCharge: sql<number>`min(gross_charge)`,
        maxGrossCharge: sql<number>`max(gross_charge)`,
        totalServices: sql<number>`count(distinct code)`,
        pricesWithNegotiatedRates: sql<number>`count(*) filter (where has_negotiated_rates = true)`,
      })
      .from(prices)
      .where(and(...conditions));

    return {
      hospital: {
        id: hospital.id,
        name: hospital.name,
        city: hospital.city,
        state: hospital.state,
        zipCode: hospital.zipCode,
      },
      prices: priceRecords,
      pagination: {
        total: Number(totalCount),
        limit,
        offset,
        hasMore: offset + limit < Number(totalCount),
      },
      statistics: {
        averageGrossCharge: stats.avgGrossCharge,
        minGrossCharge: stats.minGrossCharge,
        maxGrossCharge: stats.maxGrossCharge,
        totalServices: stats.totalServices,
        negotiatedRateCoverage: stats.pricesWithNegotiatedRates
          ? (stats.pricesWithNegotiatedRates / Number(totalCount)) * 100
          : 0,
      },
    };
  }

  async searchPricesByZipcode(params: {
    zipcode: string;
    radius?: number;
    serviceCode?: string;
    serviceName?: string;
    category?: string;
    includeNegotiatedRates?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const db = this.databaseService.db;
    const {
      zipcode,
      radius = 10,
      serviceCode,
      serviceName,
      category,
      includeNegotiatedRates = false,
      limit = 50,
      offset = 0,
    } = params;

    if (!zipcode) {
      throw new Error("Zipcode is required");
    }

    // Find hospitals within the radius
    // This is a simplified version - in production, you'd use PostGIS or similar
    const nearbyHospitals = await db
      .select({
        id: hospitals.id,
        name: hospitals.name,
        city: hospitals.city,
        state: hospitals.state,
        zipCode: hospitals.zipCode,
        distance: sql<number>`0`, // Placeholder - would calculate actual distance
      })
      .from(hospitals)
      .where(
        and(
          eq(hospitals.isActive, true),
          // Simplified zipcode matching - in production, use proper geospatial queries
          sql`substring(${hospitals.zipCode}, 1, 3) = substring(${zipcode}, 1, 3)`,
        ),
      )
      .limit(100); // Get more hospitals to filter by services

    if (nearbyHospitals.length === 0) {
      return {
        results: [],
        pagination: { total: 0, limit, offset, hasMore: false },
      };
    }

    const hospitalIds = nearbyHospitals.map((h) => h.id);

    // Build price query
    const priceConditions = [
      inArray(prices.hospitalId, hospitalIds),
      eq(prices.isActive, true),
    ];

    if (serviceCode) {
      priceConditions.push(eq(prices.serviceCode, serviceCode));
    }
    if (serviceName) {
      priceConditions.push(ilike(prices.description, `%${serviceName}%`));
    }
    if (category) {
      priceConditions.push(eq(prices.category, category));
    }
    if (includeNegotiatedRates) {
      priceConditions.push(eq(prices.hasNegotiatedRates, true));
    }

    // Get prices with hospital info
    const priceResults = await db
      .select({
        priceId: prices.id,
        code: prices.serviceCode,
        codeType: prices.codeType,
        description: prices.description,
        category: prices.category,
        grossCharge: prices.grossCharge,
        discountedCashPrice: prices.discountedCashPrice,
        minNegotiatedCharge: prices.minimumNegotiatedCharge,
        maxNegotiatedCharge: prices.maximumNegotiatedCharge,
        hasNegotiatedRates: prices.hasNegotiatedRates,
        dataQuality: prices.dataQuality,
        hospitalId: hospitals.id,
        hospitalName: hospitals.name,
        hospitalCity: hospitals.city,
        hospitalState: hospitals.state,
        hospitalZipCode: hospitals.zipCode,
      })
      .from(prices)
      .innerJoin(hospitals, eq(prices.hospitalId, hospitals.id))
      .where(and(...priceConditions))
      .orderBy(prices.grossCharge)
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(prices)
      .where(and(...priceConditions));

    // Group by service and calculate statistics
    const serviceStats = await db
      .select({
        code: prices.serviceCode,
        description: sql<string>`max(${prices.description})`,
        avgPrice: sql<number>`avg(${prices.grossCharge})`,
        minPrice: sql<number>`min(${prices.grossCharge})`,
        maxPrice: sql<number>`max(${prices.grossCharge})`,
        hospitalCount: sql<number>`count(distinct ${prices.hospitalId})`,
      })
      .from(prices)
      .where(and(...priceConditions))
      .groupBy(prices.serviceCode);

    return {
      search: {
        zipcode,
        radius,
        serviceCode,
        serviceName,
        category,
      },
      results: priceResults.map((r) => ({
        price: {
          id: r.priceId,
          code: r.code,
          codeType: r.codeType,
          description: r.description,
          category: r.category,
          grossCharge: r.grossCharge,
          discountedCashPrice: r.discountedCashPrice,
          minNegotiatedCharge: r.minNegotiatedCharge,
          maxNegotiatedCharge: r.maxNegotiatedCharge,
          hasNegotiatedRates: r.hasNegotiatedRates,
          dataQuality: r.dataQuality,
        },
        hospital: {
          id: r.hospitalId,
          name: r.hospitalName,
          city: r.hospitalCity,
          state: r.hospitalState,
          zipCode: r.hospitalZipCode,
          distance: 0, // Placeholder
        },
      })),
      statistics: serviceStats,
      pagination: {
        total: Number(totalCount),
        limit,
        offset,
        hasMore: offset + limit < Number(totalCount),
      },
    };
  }
}
