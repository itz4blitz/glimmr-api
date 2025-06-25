import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { eq, and, like, desc, asc, count } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { hospitals, prices, analytics } from '../database/schema';

interface QueryOptions {
  $top?: string;
  $skip?: string;
  $filter?: string;
  $orderby?: string;
  $count?: string;
  count?: boolean;
  select?: string;
  filter?: string;
  orderby?: string;
  top?: number;
  skip?: number;
}

interface ParsedQueryOptions {
  limit: number;
  offset: number;
  needsCount: boolean;
}

interface EntityConfig {
  table: any;
  defaultOrderBy: any;
  filterMappings: Record<string, { field: any; type: 'eq' | 'like' }>;
  orderMappings: Record<string, { field: any }>;
}

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
        },
        orderMappings: {
          name: { field: hospitals.name },
        },
      };

      const conditions = [eq(hospitals.isActive, true)];
      const filterConditions = this.buildFilterConditions(options.$filter || options.filter || '', config);
      conditions.push(...filterConditions);

      const whereClause = and(...conditions);
      const orderByClause = this.buildOrderByClause(options.$orderby || options.orderby, config);

      let totalCount: number | undefined;
      if (needsCount) {
        totalCount = await this.executeCountQuery(db, hospitals, whereClause);
      }

      const data = await db
        .select({
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
        })
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
      const { limit, offset, needsCount } = this.parseQueryOptions(options);

      const config: EntityConfig = {
        table: prices,
        defaultOrderBy: desc(prices.lastUpdated),
        filterMappings: {
          state: { field: hospitals.state, type: 'eq' },
          service: { field: prices.serviceName, type: 'like' },
        },
        orderMappings: {
          price: { field: prices.grossCharge },
          service: { field: prices.serviceName },
        },
      };

      const conditions = [eq(prices.isActive, true)];
      const filterConditions = this.buildFilterConditions(options.$filter || options.filter || '', config);
      conditions.push(...filterConditions);

      const whereClause = and(...conditions);
      const orderByClause = this.buildOrderByClause(options.$orderby || options.orderby, config);

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
        .select({
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
        })
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
      const { limit, offset, needsCount } = this.parseQueryOptions(options);

      const config: EntityConfig = {
        table: analytics,
        defaultOrderBy: desc(analytics.calculatedAt),
        filterMappings: {
          state: { field: analytics.state, type: 'eq' },
          metric: { field: analytics.metricName, type: 'eq' },
        },
        orderMappings: {
          metric: { field: analytics.metricName },
          value: { field: analytics.value },
        },
      };

      const filterConditions = this.buildFilterConditions(options.$filter || options.filter || '', config);
      const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;
      const orderByClause = this.buildOrderByClause(options.$orderby || options.orderby, config);

      let totalCount: number | undefined;
      if (needsCount) {
        totalCount = await this.executeCountQuery(db, analytics, whereClause);
      }

      const data = await db
        .select({
          id: analytics.id,
          metric: analytics.metricName,
          value: analytics.value,
          dimension: analytics.serviceCategory,
          period: analytics.period,
          state: analytics.state,
          service: analytics.serviceName,
          calculatedAt: analytics.calculatedAt,
        })
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
    return {
      limit: options.$top ? parseInt(options.$top) : (options.top || 1000),
      offset: options.$skip ? parseInt(options.$skip) : (options.skip || 0),
      needsCount: options.$count === 'true' || !!options.count,
    };
  }

  private buildFilterConditions(filter: string, config: EntityConfig): any[] {
    const conditions: any[] = [];

    if (!filter) return conditions;

    // Process each filter mapping
    for (const [filterKey, mapping] of Object.entries(config.filterMappings)) {
      if (mapping.type === 'eq') {
        const regex = new RegExp(`${filterKey} eq '([^']+)'`);
        const match = regex.exec(filter);
        if (match) {
          conditions.push(eq(mapping.field, match[1]));
        }
      } else if (mapping.type === 'like') {
        const regex = new RegExp(`contains\\(${filterKey},'([^']+)'\\)`);
        const match = regex.exec(filter);
        if (match) {
          conditions.push(like(mapping.field, `%${match[1]}%`));
        }
      }
    }

    return conditions;
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

  private formatODataResponse(context: string, data: any[], totalCount?: number) {
    return {
      '@odata.context': context,
      '@odata.count': totalCount,
      value: data,
    };
  }
}
