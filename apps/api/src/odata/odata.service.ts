import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { eq, and, like, desc, asc, count, gt, lt, gte, lte, or, ilike, not, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { hospitals, prices, analytics } from '../database/schema';

interface QueryOptions {
  $select?: string;
  $top?: string;
  $skip?: string;
  $filter?: string;
  $orderby?: string;
  $count?: string;
  $expand?: string;
  $search?: string;
  select?: string;
  filter?: string;
  orderby?: string;
  top?: number;
  skip?: number;
  count?: boolean;
  expand?: string;
  search?: string;
}

interface ParsedQueryOptions {
  limit: number;
  offset: number;
  needsCount: boolean;
  selectFields?: string[];
  searchTerm?: string;
  expandFields?: string[];
}

interface EntityConfig {
  table: any;
  defaultOrderBy: any;
  filterMappings: Record<string, { field: any; type: 'eq' | 'like' | 'gt' | 'lt' | 'ge' | 'le' }>;
  orderMappings: Record<string, { field: any }>;
  selectMappings: Record<string, any>;
  searchFields?: any[];
}

/**
 * OData v4 service providing healthcare price transparency data endpoints
 * 
 * Features:
 * - Full OData v4 query support ($select, $filter, $orderby, $top, $skip, $count, $search)
 * - Advanced filtering with and/or operators, comparison operators (eq, ne, gt, lt, ge, le)
 * - String functions (contains, startswith, endswith)
 * - Computed fields for enhanced analytics
 * - Pagination with next/previous links
 * - Batch operations for multiple queries
 * - Comprehensive error handling with OData-compliant error responses
 * 
 * Supported entities:
 * - hospitals: Hospital information with location and facility details
 * - prices: Price transparency data with computed discount and spread calculations
 * - analytics: Aggregated metrics with confidence and sample size indicators
 */
@Injectable()
export class ODataService {
  constructor(
    private readonly databaseService: DatabaseService,
    @InjectPinoLogger(ODataService.name)
    private readonly logger: PinoLogger,
  ) {}
  async getServiceDocument(req: any) {
    // Force HTTPS for production
    const protocol = req.get('x-forwarded-proto') ?? req.protocol;
    const baseUrl = `${protocol}://${req.get('host')}/odata`;

    return {
      '@odata.context': `${baseUrl}/$metadata`,
      '@odata.metadataEtag': 'W/"MjAyNS0wNi0yMlQxOTowOToyNloA"',
      value: [
        {
          name: 'hospitals',
          kind: 'EntitySet',
          url: 'hospitals',
        },
        {
          name: 'prices',
          kind: 'EntitySet',
          url: 'prices',
        },
        {
          name: 'analytics',
          kind: 'EntitySet',
          url: 'analytics',
        },
      ],
    };
  }

  async getMetadata() {
    // OData metadata XML document - PowerBI compliant
    return `<?xml version="1.0" encoding="UTF-8"?>
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
  <edmx:DataServices>
    <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="Glimmr" Alias="Self">

      <EntityType Name="Hospital">
        <Key>
          <PropertyRef Name="id"/>
        </Key>
        <Property Name="id" Type="Edm.String" Nullable="false"/>
        <Property Name="name" Type="Edm.String" Nullable="false"/>
        <Property Name="state" Type="Edm.String" Nullable="false"/>
        <Property Name="city" Type="Edm.String" Nullable="false"/>
        <Property Name="address" Type="Edm.String" Nullable="true"/>
        <Property Name="phone" Type="Edm.String" Nullable="true"/>
        <Property Name="website" Type="Edm.String" Nullable="true"/>
        <Property Name="bedCount" Type="Edm.Int32" Nullable="true"/>
        <Property Name="ownership" Type="Edm.String" Nullable="true"/>
        <Property Name="lastUpdated" Type="Edm.DateTimeOffset" Nullable="true"/>
        <Property Name="hasLocation" Type="Edm.Boolean" Nullable="true"/>
        <Property Name="daysSinceLastUpdate" Type="Edm.Int32" Nullable="true"/>
        <Property Name="fullAddress" Type="Edm.String" Nullable="true"/>
      </EntityType>

      <EntityType Name="Price">
        <Key>
          <PropertyRef Name="id"/>
        </Key>
        <Property Name="id" Type="Edm.String" Nullable="false"/>
        <Property Name="hospitalId" Type="Edm.String" Nullable="false"/>
        <Property Name="hospitalName" Type="Edm.String" Nullable="true"/>
        <Property Name="service" Type="Edm.String" Nullable="false"/>
        <Property Name="code" Type="Edm.String" Nullable="true"/>
        <Property Name="price" Type="Edm.Decimal" Nullable="false" Precision="19" Scale="2"/>
        <Property Name="description" Type="Edm.String" Nullable="true"/>
        <Property Name="category" Type="Edm.String" Nullable="true"/>
        <Property Name="state" Type="Edm.String" Nullable="true"/>
        <Property Name="city" Type="Edm.String" Nullable="true"/>
        <Property Name="lastUpdated" Type="Edm.DateTimeOffset" Nullable="true"/>
        <Property Name="priceSpread" Type="Edm.Decimal" Nullable="true" Precision="19" Scale="2"/>
        <Property Name="discountPercentage" Type="Edm.Decimal" Nullable="true" Precision="5" Scale="2"/>
        <Property Name="hasNegotiatedRates" Type="Edm.Boolean" Nullable="true"/>
        <Property Name="daysSinceLastUpdate" Type="Edm.Int32" Nullable="true"/>
      </EntityType>

      <EntityType Name="Analytic">
        <Key>
          <PropertyRef Name="id"/>
        </Key>
        <Property Name="id" Type="Edm.String" Nullable="false"/>
        <Property Name="metric" Type="Edm.String" Nullable="false"/>
        <Property Name="value" Type="Edm.Decimal" Nullable="false" Precision="19" Scale="2"/>
        <Property Name="dimension" Type="Edm.String" Nullable="true"/>
        <Property Name="period" Type="Edm.String" Nullable="true"/>
        <Property Name="state" Type="Edm.String" Nullable="true"/>
        <Property Name="service" Type="Edm.String" Nullable="true"/>
        <Property Name="calculatedAt" Type="Edm.DateTimeOffset" Nullable="true"/>
        <Property Name="daysSinceCalculated" Type="Edm.Int32" Nullable="true"/>
        <Property Name="confidenceLevel" Type="Edm.String" Nullable="true"/>
        <Property Name="sampleSizeCategory" Type="Edm.String" Nullable="true"/>
      </EntityType>

      <EntityContainer Name="Container">
        <EntitySet Name="hospitals" EntityType="Glimmr.Hospital"/>
        <EntitySet Name="prices" EntityType="Glimmr.Price"/>
        <EntitySet Name="analytics" EntityType="Glimmr.Analytic"/>
      </EntityContainer>

    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;
  }

  async getHospitals(options: QueryOptions) {
    this.logger.info({
      msg: 'Fetching hospitals for OData',
      options,
      operation: 'getHospitals',
    });

    try {
      const db = this.databaseService.db;
      const { limit, offset, needsCount } = this.parseQueryOptions(options);

      const config: EntityConfig = {
        table: hospitals,
        defaultOrderBy: asc(hospitals.name),
        filterMappings: {
          state: { field: hospitals.state, type: 'eq' },
          name: { field: hospitals.name, type: 'like' },
          city: { field: hospitals.city, type: 'like' },
          ownership: { field: hospitals.ownership, type: 'eq' },
          bedCount: { field: hospitals.bedCount, type: 'gt' },
        },
        orderMappings: {
          name: { field: hospitals.name },
          state: { field: hospitals.state },
          city: { field: hospitals.city },
          bedCount: { field: hospitals.bedCount },
        },
        selectMappings: {
          id: hospitals.id,
          name: hospitals.name,
          state: hospitals.state,
          city: hospitals.city,
          address: hospitals.address,
          phone: hospitals.phone,
          website: hospitals.website,
          bedCount: hospitals.bedCount,
          ownership: hospitals.ownership,
          lastUpdated: hospitals.lastUpdated,
          // Computed fields
          hasLocation: sql<boolean>`CASE WHEN ${hospitals.latitude} IS NOT NULL AND ${hospitals.longitude} IS NOT NULL THEN true ELSE false END`.as('hasLocation'),
          daysSinceLastUpdate: sql<number>`EXTRACT(day FROM CURRENT_TIMESTAMP - ${hospitals.lastUpdated})`.as('daysSinceLastUpdate'),
          fullAddress: sql<string>`CONCAT(${hospitals.address}, ', ', ${hospitals.city}, ', ', ${hospitals.state}, ' ', ${hospitals.zipCode})`.as('fullAddress'),
        },
        searchFields: [hospitals.name, hospitals.city, hospitals.address],
      };

      const conditions = [eq(hospitals.isActive, true)];
      
      // Add filter conditions
      const filterConditions = this.buildFilterConditions(options.$filter || options.filter || '', config);
      conditions.push(...filterConditions);

      // Add search conditions
      const searchConditions = this.buildSearchConditions(searchTerm, config);
      conditions.push(...searchConditions);

      const whereClause = and(...conditions);
      const orderByClause = this.buildOrderByClause(options.$orderby || options.orderby, config);
      const selectClause = this.buildSelectClause(selectFields, config);

      let totalCount: number | undefined;
      if (needsCount) {
        totalCount = await this.executeCountQuery(db, hospitals, whereClause);
      }

      const data = await db
        .select(selectClause)
        .from(hospitals)
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset);

      this.logger.info({
        msg: 'Hospitals fetched successfully for OData',
        count: data.length,
        totalCount,
        operation: 'getHospitals',
      });

      return this.formatODataResponse(
        'https://api.glimmr.health/odata/$metadata#hospitals',
        data,
        totalCount,
        { limit, offset, baseUrl: 'https://api.glimmr.health/odata/hospitals' }
      );
    } catch (error) {
      this.logger.error({
        msg: 'Failed to fetch hospitals for OData',
        error: error.message,
        operation: 'getHospitals',
        options,
      });
      throw error;
    }
  }

  async getPrices(options: QueryOptions) {
    this.logger.info({
      msg: 'Fetching prices for OData',
      options,
      operation: 'getPrices',
    });

    try {
      const db = this.databaseService.db;
      const { limit, offset, needsCount, selectFields, searchTerm } = this.parseQueryOptions(options);

      const config: EntityConfig = {
        table: prices,
        defaultOrderBy: desc(prices.lastUpdated),
        filterMappings: {
          state: { field: hospitals.state, type: 'eq' },
          service: { field: prices.serviceName, type: 'like' },
          category: { field: prices.category, type: 'eq' },
          price: { field: prices.grossCharge, type: 'gt' },
          hospitalName: { field: hospitals.name, type: 'like' },
        },
        orderMappings: {
          price: { field: prices.grossCharge },
          service: { field: prices.serviceName },
          lastUpdated: { field: prices.lastUpdated },
        },
        selectMappings: {
          id: prices.id,
          hospitalId: prices.hospitalId,
          hospitalName: hospitals.name,
          service: prices.serviceName,
          code: prices.serviceCode,
          price: prices.grossCharge,
          description: prices.description,
          category: prices.category,
          state: hospitals.state,
          city: hospitals.city,
          lastUpdated: prices.lastUpdated,
          // Computed fields
          priceSpread: sql<number>`CASE WHEN ${prices.maximumNegotiatedCharge} IS NOT NULL AND ${prices.minimumNegotiatedCharge} IS NOT NULL THEN ${prices.maximumNegotiatedCharge} - ${prices.minimumNegotiatedCharge} ELSE NULL END`.as('priceSpread'),
          discountPercentage: sql<number>`CASE WHEN ${prices.grossCharge} > 0 AND ${prices.discountedCashPrice} IS NOT NULL THEN (${prices.grossCharge} - ${prices.discountedCashPrice}) / ${prices.grossCharge} * 100 ELSE NULL END`.as('discountPercentage'),
          hasNegotiatedRates: sql<boolean>`CASE WHEN ${prices.minimumNegotiatedCharge} IS NOT NULL OR ${prices.maximumNegotiatedCharge} IS NOT NULL THEN true ELSE false END`.as('hasNegotiatedRates'),
          daysSinceLastUpdate: sql<number>`EXTRACT(day FROM CURRENT_TIMESTAMP - ${prices.lastUpdated})`.as('daysSinceLastUpdate'),
        },
        searchFields: [prices.serviceName, prices.description, hospitals.name],
      };

      const conditions = [eq(prices.isActive, true)];
      
      // Add filter conditions
      const filterConditions = this.buildFilterConditions(options.$filter || options.filter || '', config);
      conditions.push(...filterConditions);

      // Add search conditions
      const searchConditions = this.buildSearchConditions(searchTerm, config);
      conditions.push(...searchConditions);

      const whereClause = and(...conditions);
      const orderByClause = this.buildOrderByClause(options.$orderby || options.orderby, config);
      const selectClause = this.buildSelectClause(selectFields, config);

      let totalCount: number | undefined;
      if (needsCount) {
        const [countResult] = await db
          .select({ count: count() })
          .from(prices)
          .leftJoin(hospitals, eq(prices.hospitalId, hospitals.id))
          .where(whereClause);
        totalCount = countResult.count;
      }

      const data = await db
        .select(selectClause)
        .from(prices)
        .leftJoin(hospitals, eq(prices.hospitalId, hospitals.id))
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset);

      this.logger.info({
        msg: 'Prices fetched successfully for OData',
        count: data.length,
        totalCount,
        operation: 'getPrices',
      });

      return this.formatODataResponse(
        'https://api.glimmr.health/odata/$metadata#prices',
        data,
        totalCount,
        { limit, offset, baseUrl: 'https://api.glimmr.health/odata/prices' }
      );
    } catch (error) {
      this.logger.error({
        msg: 'Failed to fetch prices for OData',
        error: error.message,
        operation: 'getPrices',
        options,
      });
      throw error;
    }
  }

  async getAnalytics(options: QueryOptions) {
    this.logger.info({
      msg: 'Fetching analytics for OData',
      options,
      operation: 'getAnalytics',
    });

    try {
      const db = this.databaseService.db;
      const { limit, offset, needsCount, selectFields, searchTerm } = this.parseQueryOptions(options);

      const config: EntityConfig = {
        table: analytics,
        defaultOrderBy: desc(analytics.calculatedAt),
        filterMappings: {
          state: { field: analytics.state, type: 'eq' },
          metric: { field: analytics.metricName, type: 'eq' },
          period: { field: analytics.period, type: 'eq' },
          value: { field: analytics.value, type: 'gt' },
          service: { field: analytics.serviceName, type: 'like' },
        },
        orderMappings: {
          metric: { field: analytics.metricName },
          value: { field: analytics.value },
          calculatedAt: { field: analytics.calculatedAt },
        },
        selectMappings: {
          id: analytics.id,
          metric: analytics.metricName,
          value: analytics.value,
          dimension: analytics.serviceCategory,
          period: analytics.period,
          state: analytics.state,
          service: analytics.serviceName,
          calculatedAt: analytics.calculatedAt,
          // Computed fields
          daysSinceCalculated: sql<number>`EXTRACT(day FROM CURRENT_TIMESTAMP - ${analytics.calculatedAt})`.as('daysSinceCalculated'),
          confidenceLevel: sql<string>`CASE WHEN ${analytics.confidence} >= 0.9 THEN 'high' WHEN ${analytics.confidence} >= 0.7 THEN 'medium' ELSE 'low' END`.as('confidenceLevel'),
          sampleSizeCategory: sql<string>`CASE WHEN ${analytics.sampleSize} >= 1000 THEN 'large' WHEN ${analytics.sampleSize} >= 100 THEN 'medium' ELSE 'small' END`.as('sampleSizeCategory'),
        },
        searchFields: [analytics.metricName, analytics.serviceName],
      };

      const conditions: any[] = [];
      
      // Add filter conditions
      const filterConditions = this.buildFilterConditions(options.$filter || options.filter || '', config);
      conditions.push(...filterConditions);

      // Add search conditions
      const searchConditions = this.buildSearchConditions(searchTerm, config);
      conditions.push(...searchConditions);

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const orderByClause = this.buildOrderByClause(options.$orderby || options.orderby, config);
      const selectClause = this.buildSelectClause(selectFields, config);

      let totalCount: number | undefined;
      if (needsCount) {
        totalCount = await this.executeCountQuery(db, analytics, whereClause);
      }

      const data = await db
        .select(selectClause)
        .from(analytics)
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset);

      this.logger.info({
        msg: 'Analytics fetched successfully for OData',
        count: data.length,
        totalCount,
        operation: 'getAnalytics',
      });

      return this.formatODataResponse(
        'https://api.glimmr.health/odata/$metadata#analytics',
        data,
        totalCount,
        { limit, offset, baseUrl: 'https://api.glimmr.health/odata/analytics' }
      );
    } catch (error) {
      this.logger.error({
        msg: 'Failed to fetch analytics for OData',
        error: error.message,
        operation: 'getAnalytics',
        options,
      });
      throw error;
    }
  }

  private parseQueryOptions(options: QueryOptions): ParsedQueryOptions {
    const selectStr = options.$select || options.select;
    const searchStr = options.$search || options.search;
    const expandStr = options.$expand || options.expand;
    
    // Validate top parameter
    const rawTop = options.$top ? parseInt(options.$top) : (options.top || 1000);
    if (isNaN(rawTop) || rawTop < 0) {
      throw new Error('ValidationError: $top must be a non-negative number');
    }
    
    // Validate skip parameter
    const rawSkip = options.$skip ? parseInt(options.$skip) : (options.skip || 0);
    if (isNaN(rawSkip) || rawSkip < 0) {
      throw new Error('ValidationError: $skip must be a non-negative number');
    }
    
    return {
      limit: Math.min(rawTop, 10000), // Max 10k records for performance
      offset: rawSkip,
      needsCount: options.$count === 'true' || !!options.count,
      selectFields: selectStr ? selectStr.split(',').map(f => f.trim()) : undefined,
      searchTerm: searchStr,
      expandFields: expandStr ? expandStr.split(',').map(f => f.trim()) : undefined,
    };
  }

  private buildFilterConditions(filter: string, config: EntityConfig): any[] {
    const conditions: any[] = [];

    if (!filter) return conditions;

    try {
      // Handle 'and' and 'or' operators by splitting first
      const orClauses = filter.split(' or ');
      const orConditions: any[] = [];

      for (const orClause of orClauses) {
        const andClauses = orClause.split(' and ');
        const andConditions: any[] = [];

        for (const andClause of andClauses) {
          const clauseConditions = this.parseFilterClause(andClause.trim(), config);
          andConditions.push(...clauseConditions);
        }

        if (andConditions.length > 1) {
          orConditions.push(and(...andConditions));
        } else if (andConditions.length === 1) {
          orConditions.push(andConditions[0]);
        }
      }

      if (orConditions.length > 1) {
        conditions.push(or(...orConditions));
      } else if (orConditions.length === 1) {
        conditions.push(orConditions[0]);
      }

      return conditions;
    } catch (error) {
      this.logger.warn({
        msg: 'Failed to parse filter conditions',
        filter,
        error: error.message,
      });
      return [];
    }
  }

  private parseFilterClause(clause: string, config: EntityConfig): any[] {
    const conditions: any[] = [];

    for (const [filterKey, mapping] of Object.entries(config.filterMappings)) {
      // Handle different operators
      const operators = [
        { op: 'eq', regex: new RegExp(`${filterKey}\\s+eq\\s+'([^']+)'`), fn: eq },
        { op: 'ne', regex: new RegExp(`${filterKey}\\s+ne\\s+'([^']+)'`), fn: (field: any, value: any) => not(eq(field, value)) },
        { op: 'gt', regex: new RegExp(`${filterKey}\\s+gt\\s+(\\d+(?:\\.\\d+)?)`), fn: gt },
        { op: 'ge', regex: new RegExp(`${filterKey}\\s+ge\\s+(\\d+(?:\\.\\d+)?)`), fn: gte },
        { op: 'lt', regex: new RegExp(`${filterKey}\\s+lt\\s+(\\d+(?:\\.\\d+)?)`), fn: lt },
        { op: 'le', regex: new RegExp(`${filterKey}\\s+le\\s+(\\d+(?:\\.\\d+)?)`), fn: lte },
      ];

      for (const { op, regex, fn } of operators) {
        const match = regex.exec(clause);
        if (match) {
          const value = op === 'gt' || op === 'ge' || op === 'lt' || op === 'le' 
            ? parseFloat(match[1]) 
            : match[1];
          conditions.push(fn(mapping.field, value));
        }
      }

      // Handle contains function
      if (mapping.type === 'like') {
        const containsRegex = new RegExp(`contains\\(${filterKey},'([^']+)'\\)`);
        const startsWithRegex = new RegExp(`startswith\\(${filterKey},'([^']+)'\\)`);
        const endsWithRegex = new RegExp(`endswith\\(${filterKey},'([^']+)'\\)`);
        
        let match = containsRegex.exec(clause);
        if (match) {
          conditions.push(ilike(mapping.field, `%${match[1]}%`));
        }
        
        match = startsWithRegex.exec(clause);
        if (match) {
          conditions.push(ilike(mapping.field, `${match[1]}%`));
        }
        
        match = endsWithRegex.exec(clause);
        if (match) {
          conditions.push(ilike(mapping.field, `%${match[1]}`));
        }
      }
    }

    return conditions;
  }

  private buildSearchConditions(searchTerm: string | undefined, config: EntityConfig): any[] {
    if (!searchTerm || !config.searchFields || config.searchFields.length === 0) {
      return [];
    }

    const searchConditions = config.searchFields.map(field => 
      ilike(field, `%${searchTerm}%`)
    );

    return [or(...searchConditions)];
  }

  private buildSelectClause(selectFields: string[] | undefined, config: EntityConfig): any {
    if (!selectFields || selectFields.length === 0) {
      return config.selectMappings;
    }

    const selectClause: any = {};
    for (const field of selectFields) {
      if (config.selectMappings[field]) {
        selectClause[field] = config.selectMappings[field];
      }
    }

    return Object.keys(selectClause).length > 0 ? selectClause : config.selectMappings;
  }

  private buildOrderByClause(orderby: string | undefined, config: EntityConfig): any {
    if (!orderby) return config.defaultOrderBy;

    for (const [orderKey, mapping] of Object.entries(config.orderMappings)) {
      if (orderby.includes(orderKey)) {
        return orderby.includes('desc') ? desc(mapping.field) : asc(mapping.field);
      }
    }

    return config.defaultOrderBy;
  }

  private async executeCountQuery(db: any, table: any, whereClause: any): Promise<number> {
    const [countResult] = await db
      .select({ count: count() })
      .from(table)
      .where(whereClause);
    return countResult.count;
  }

  private formatODataResponse(
    context: string, 
    data: any[], 
    totalCount?: number, 
    options?: { limit: number; offset: number; baseUrl?: string }
  ) {
    const response: any = {
      '@odata.context': context,
      value: data,
    };
    
    if (totalCount !== undefined) {
      response['@odata.count'] = totalCount;
    }

    // Add pagination links
    if (options && options.baseUrl) {
      const { limit, offset, baseUrl } = options;
      
      // Add next link if there are more records
      if (totalCount && offset + limit < totalCount) {
        const nextOffset = offset + limit;
        response['@odata.nextLink'] = `${baseUrl}?$skip=${nextOffset}&$top=${limit}`;
      }

      // Add previous link if not on first page
      if (offset > 0) {
        const prevOffset = Math.max(0, offset - limit);
        response['@odata.prevLink'] = `${baseUrl}?$skip=${prevOffset}&$top=${limit}`;
      }
    }
    
    return response;
  }

  formatODataError(title: string, message: string, target?: string) {
    return {
      error: {
        code: 'InternalServerError',
        message: `${title}: ${message}`,
        target,
      },
    };
  }

  async processBatch(batchBody: string, req: any): Promise<string> {
    this.logger.info({
      msg: 'Processing OData batch request',
      operation: 'processBatch',
    });

    try {
      // Simple batch implementation for GET requests only
      const requests = this.parseBatchBody(batchBody);
      const responses: string[] = [];
      
      let responseId = 1;
      for (const request of requests) {
        try {
          let result: any;
          const query = this.parseUrlQuery(request.url);
          
          if (request.url.includes('/hospitals')) {
            result = await this.getHospitals(query);
          } else if (request.url.includes('/prices')) {
            result = await this.getPrices(query);
          } else if (request.url.includes('/analytics')) {
            result = await this.getAnalytics(query);
          } else {
            throw new Error('Unsupported batch request URL');
          }

          responses.push(this.formatBatchResponse(responseId++, 200, result));
        } catch (error) {
          responses.push(this.formatBatchErrorResponse(responseId++, 500, error.message));
        }
      }

      return this.createBatchResponse(responses);
    } catch (error) {
      this.logger.error({
        msg: 'Failed to process batch request',
        error: error.message,
        operation: 'processBatch',
      });
      throw error;
    }
  }

  private parseBatchBody(batchBody: string): Array<{ method: string; url: string }> {
    // Simplified batch parsing - in production, this would be more robust
    const requests: Array<{ method: string; url: string }> = [];
    const lines = batchBody.split('\n');
    
    let currentRequest: any = {};
    for (const line of lines) {
      if (line.startsWith('GET ')) {
        const url = line.replace('GET ', '').trim();
        requests.push({ method: 'GET', url });
      }
    }
    
    return requests;
  }

  private parseUrlQuery(url: string): QueryOptions {
    const urlObj = new URL(url, 'http://localhost');
    const params = urlObj.searchParams;
    
    return {
      $select: params.get('$select') || undefined,
      $filter: params.get('$filter') || undefined,
      $orderby: params.get('$orderby') || undefined,
      $top: params.get('$top') || undefined,
      $skip: params.get('$skip') || undefined,
      $count: params.get('$count') || undefined,
      $search: params.get('$search') || undefined,
    };
  }

  private formatBatchResponse(id: number, status: number, data: any): string {
    return `--batchresponse
Content-Type: application/http
Content-Transfer-Encoding: binary

HTTP/1.1 ${status} OK
Content-Type: application/json;odata.metadata=minimal
OData-Version: 4.0

${JSON.stringify(data)}`;
  }

  private formatBatchErrorResponse(id: number, status: number, message: string): string {
    const error = this.formatODataError('Batch request error', message);
    return `--batchresponse
Content-Type: application/http
Content-Transfer-Encoding: binary

HTTP/1.1 ${status} Error
Content-Type: application/json;odata.metadata=minimal
OData-Version: 4.0

${JSON.stringify(error)}`;
  }

  private createBatchResponse(responses: string[]): string {
    return `--batchresponse
Content-Type: multipart/mixed; boundary=batchresponse

${responses.join('\n')}
--batchresponse--`;
  }
}
