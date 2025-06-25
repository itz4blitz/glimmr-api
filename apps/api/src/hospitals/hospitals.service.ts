import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { eq, and, like, asc, count } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { hospitals, prices } from '../database/schema';
import { PatientRightsAdvocateService } from '../external-apis/patient-rights-advocate.service';

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
      throw error;
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
        return null;
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
      this.logger.error({
        msg: 'Failed to fetch hospital',
        hospitalId: id,
        error: error.message,
        operation: 'getHospitalById',
      });
      throw error;
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

      // Process each hospital
      for (const praHospital of praHospitals) {
        try {
          // Check if hospital already exists by CCN (CMS Certification Number)
          const [existingHospital] = await db
            .select()
            .from(hospitals)
            .where(eq(hospitals.ccn, praHospital.ccn))
            .limit(1);

          const hospitalData = {
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
          };

          if (existingHospital) {
            // Update existing hospital
            await db
              .update(hospitals)
              .set(hospitalData)
              .where(eq(hospitals.id, existingHospital.id));
            updated++;

            this.logger.debug({
              msg: 'Updated existing hospital',
              hospitalName: praHospital.name,
              ccn: praHospital.ccn,
              operation: 'syncHospitalsFromPRA',
            });
          } else {
            // Insert new hospital
            await db.insert(hospitals).values(hospitalData);
            imported++;

            this.logger.debug({
              msg: 'Imported new hospital',
              hospitalName: praHospital.name,
              ccn: praHospital.ccn,
              operation: 'syncHospitalsFromPRA',
            });
          }
        } catch (error) {
          errors++;
          this.logger.error({
            msg: 'Failed to process hospital',
            hospitalName: praHospital.name,
            ccn: praHospital.ccn,
            error: error.message,
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
