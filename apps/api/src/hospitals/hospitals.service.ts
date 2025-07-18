import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { eq, and, like, asc, count, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { hospitals, prices } from '../database/schema';
import { PatientRightsAdvocateService } from '../external-apis/patient-rights-advocate.service';
import { HospitalNotFoundException, DatabaseOperationException } from '../common/exceptions';

@Injectable()
export class HospitalsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly patientRightsAdvocateService: PatientRightsAdvocateService,
    @InjectPinoLogger(HospitalsService.name)
    private readonly logger: PinoLogger,
  ) {}
  async getHospitals(filters: {
    state?: string;
    city?: string;
    name?: string;
    limit?: number;
    offset?: number;
  }) {
    this.logger.info({
      msg: 'Fetching hospitals with filters',
      filters,
      operation: 'getHospitals',
    });

    const startTime = Date.now();

    try {
      const db = this.databaseService.db;
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      // Build where conditions
      const conditions = [];
      if (filters.state) {
        conditions.push(eq(hospitals.state, filters.state));
      }
      if (filters.city) {
        conditions.push(like(hospitals.city, `%${filters.city}%`));
      }
      if (filters.name) {
        conditions.push(like(hospitals.name, `%${filters.name}%`));
      }

      // Add active filter
      conditions.push(eq(hospitals.isActive, true));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const [totalResult] = await db
        .select({ count: count() })
        .from(hospitals)
        .where(whereClause);

      // Get paginated data
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
          hospitalType: hospitals.hospitalType,
          lastUpdated: hospitals.lastUpdated,
        })
        .from(hospitals)
        .where(whereClause)
        .orderBy(asc(hospitals.name))
        .limit(limit)
        .offset(offset);

      const result = {
        data,
        total: totalResult.count,
        limit,
        offset,
      };

      const duration = Date.now() - startTime;
      this.logger.info({
        msg: 'Hospitals fetched successfully',
        count: result.data.length,
        total: result.total,
        duration,
        operation: 'getHospitals',
        filters,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        msg: 'Failed to fetch hospitals',
        error: error.message,
        duration,
        operation: 'getHospitals',
        filters,
      });
      throw new DatabaseOperationException('fetch hospitals', error.message);
    }
  }

  async getHospitalById(id: string) {
    this.logger.info({
      msg: 'Fetching hospital by ID',
      hospitalId: id,
      operation: 'getHospitalById',
    });

    try {
      const db = this.databaseService.db;

      const [hospital] = await db
        .select()
        .from(hospitals)
        .where(and(eq(hospitals.id, id), eq(hospitals.isActive, true)))
        .limit(1);

      if (!hospital) {
        this.logger.warn({
          msg: 'Hospital not found',
          hospitalId: id,
          operation: 'getHospitalById',
        });
        throw new HospitalNotFoundException(id);
      }

      // Get unique services for this hospital
      const servicesResult = await db
        .select({ category: prices.category })
        .from(prices)
        .where(and(eq(prices.hospitalId, id), eq(prices.isActive, true)))
        .groupBy(prices.category);

      const services = servicesResult.map(s => s.category).filter(Boolean);

      const result = {
        ...hospital,
        services,
      };

      this.logger.info({
        msg: 'Hospital fetched successfully',
        hospitalId: id,
        hospitalName: result.name,
        operation: 'getHospitalById',
      });

      return result;
    } catch (error) {
      if (error instanceof HospitalNotFoundException) {
        throw error;
      }
      
      this.logger.error({
        msg: 'Failed to fetch hospital',
        hospitalId: id,
        error: error.message,
        operation: 'getHospitalById',
      });
      throw new DatabaseOperationException('fetch hospital', error.message);
    }
  }

  async getHospitalPrices(id: string, filters: { service?: string }) {
    this.logger.info({
      msg: 'Fetching hospital prices',
      hospitalId: id,
      filters,
      operation: 'getHospitalPrices',
    });

    try {
      const db = this.databaseService.db;

      // Build where conditions
      const conditions = [
        eq(prices.hospitalId, id),
        eq(prices.isActive, true)
      ];

      if (filters.service) {
        conditions.push(like(prices.serviceName, `%${filters.service}%`));
      }

      const whereClause = and(...conditions);

      // Get total count
      const [totalResult] = await db
        .select({ count: count() })
        .from(prices)
        .where(whereClause);

      // Get price data
      const data = await db
        .select({
          id: prices.id,
          service: prices.serviceName,
          code: prices.serviceCode,
          price: prices.grossCharge,
          discountedCashPrice: prices.discountedCashPrice,
          description: prices.description,
          category: prices.category,
          lastUpdated: prices.lastUpdated,
        })
        .from(prices)
        .where(whereClause)
        .orderBy(asc(prices.serviceName));

      const result = {
        hospitalId: id,
        data,
        total: totalResult.count,
      };

      this.logger.info({
        msg: 'Hospital prices fetched successfully',
        hospitalId: id,
        priceCount: result.data.length,
        operation: 'getHospitalPrices',
      });

      return result;
    } catch (error) {
      this.logger.error({
        msg: 'Failed to fetch hospital prices',
        hospitalId: id,
        error: error.message,
        operation: 'getHospitalPrices',
      });
      throw error;
    }
  }

  /**
   * Sync hospitals from Patient Rights Advocate API to database
   */
  async syncHospitalsFromPRA(state?: string): Promise<{ imported: number; updated: number; errors: number }> {
    this.logger.info({
      msg: 'Starting hospital sync from Patient Rights Advocate API',
      state,
      operation: 'syncHospitalsFromPRA',
    });

    const startTime = Date.now();
    let imported = 0;
    let updated = 0;
    let errors = 0;

    try {
      const db = this.databaseService.db;

      // Fetch hospitals from PRA API
      const praHospitals = state
        ? await this.patientRightsAdvocateService.getHospitalsByState(state)
        : await this.patientRightsAdvocateService.getAllHospitals();

      this.logger.info({
        msg: 'Fetched hospitals from PRA API',
        count: praHospitals.length,
        state,
        operation: 'syncHospitalsFromPRA',
      });

      // Prepare data for batch upsert to eliminate N+1 queries
      const hospitalDataBatch = praHospitals
        .filter(praHospital => praHospital.ccn) // Only process hospitals with CCN
        .map(praHospital => ({
          name: praHospital.name,
          address: praHospital.address,
          city: praHospital.city,
          state: praHospital.state,
          zipCode: praHospital.zip,
          phone: praHospital.phone,
          website: praHospital.url || null,
          bedCount: praHospital.beds ? parseInt(praHospital.beds) : null,
          latitude: praHospital.lat ? praHospital.lat : null,
          longitude: praHospital.long ? praHospital.long : null,
          ccn: praHospital.ccn,
          externalId: praHospital.id, // Store PRA ID as external ID
          dataSource: 'patient_rights_advocate' as const,
          sourceUrl: praHospital.url || null,
          isActive: true,
          lastUpdated: new Date(),
          priceTransparencyFiles: JSON.stringify(praHospital.files),
          lastFileCheck: new Date(),
          updatedAt: new Date(), // Explicitly set for upsert
        }));

      errors = praHospitals.length - hospitalDataBatch.length; // Count hospitals without CCN as errors

      if (hospitalDataBatch.length === 0) {
        this.logger.warn({
          msg: 'No valid hospitals to process (all missing CCN)',
          totalHospitals: praHospitals.length,
          operation: 'syncHospitalsFromPRA',
        });
      } else {
        // Perform batch upsert using INSERT ... ON CONFLICT
        try {
          const result = await db
            .insert(hospitals)
            .values(hospitalDataBatch)
            .onConflictDoUpdate({
              target: hospitals.ccn,
              set: {
                name: sql.raw('excluded.name'),
                address: sql.raw('excluded.address'),
                city: sql.raw('excluded.city'),
                state: sql.raw('excluded.state'),
                zipCode: sql.raw('excluded.zip_code'),
                phone: sql.raw('excluded.phone'),
                website: sql.raw('excluded.website'),
                bedCount: sql.raw('excluded.bed_count'),
                latitude: sql.raw('excluded.latitude'),
                longitude: sql.raw('excluded.longitude'),
                externalId: sql.raw('excluded.external_id'),
                sourceUrl: sql.raw('excluded.source_url'),
                isActive: sql.raw('excluded.is_active'),
                lastUpdated: sql.raw('excluded.last_updated'),
                priceTransparencyFiles: sql.raw('excluded.price_transparency_files'),
                lastFileCheck: sql.raw('excluded.last_file_check'),
                updatedAt: sql.raw('excluded.updated_at'),
              },
            })
            .returning({ id: hospitals.id, ccn: hospitals.ccn });

          // Count results: we can determine if records were inserted or updated
          // by checking against existing records, but for simplicity, we'll log the total
          imported = hospitalDataBatch.length; // This is an approximation
          updated = 0; // We can't easily distinguish between insert/update with this method

          this.logger.info({
            msg: 'Batch upsert completed',
            processed: result.length,
            totalReceived: praHospitals.length,
            validForProcessing: hospitalDataBatch.length,
            operation: 'syncHospitalsFromPRA',
          });
        } catch (error) {
          errors += hospitalDataBatch.length;
          this.logger.error({
            msg: 'Batch upsert failed',
            error: error.message,
            batchSize: hospitalDataBatch.length,
            operation: 'syncHospitalsFromPRA',
          });
        }
      }

      const duration = Date.now() - startTime;
      const result = { imported, updated, errors };

      this.logger.info({
        msg: 'Hospital sync completed',
        result,
        duration,
        state,
        operation: 'syncHospitalsFromPRA',
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        msg: 'Hospital sync failed',
        error: error.message,
        duration,
        state,
        operation: 'syncHospitalsFromPRA',
      });
      throw error;
    }
  }

  /**
   * Get rate limit status from Patient Rights Advocate API
   */
  getPRARateLimitStatus() {
    return this.patientRightsAdvocateService.getRateLimitStatus();
  }

  /**
   * Get session status from Patient Rights Advocate API
   */
  getPRASessionStatus() {
    return this.patientRightsAdvocateService.getSessionStatus();
  }
}
