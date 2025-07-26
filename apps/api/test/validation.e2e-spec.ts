import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { JobsController } from "../src/jobs/jobs.controller";
import { HospitalsController } from "../src/hospitals/hospitals.controller";
import { PricesController } from "../src/prices/prices.controller";
import { AnalyticsController } from "../src/analytics/analytics.controller";
import { ODataController } from "../src/odata/odata.controller";
import { JobsService } from "../src/jobs/jobs.service";
import { HospitalMonitorService } from "../src/jobs/services/hospital-monitor.service";
import { PRAPipelineService } from "../src/jobs/services/pra-pipeline.service";
import { HospitalsService } from "../src/hospitals/hospitals.service";
import { PricesService } from "../src/prices/prices.service";
import { AnalyticsService } from "../src/analytics/analytics.service";
import { ODataService } from "../src/odata/odata.service";

describe("Validation E2E Tests", () => {
  let app: INestApplication;

  // Mock services
  const mockJobsService = {
    getJobs: jest.fn().mockResolvedValue({ jobs: [], total: 0 }),
    startHospitalImport: jest.fn().mockResolvedValue({ jobId: "test-job-1" }),
    startPriceUpdate: jest.fn().mockResolvedValue({ jobId: "test-job-2" }),
    getJobById: jest
      .fn()
      .mockResolvedValue({ id: "test-job-1", status: "completed" }),
    getJobStats: jest.fn().mockResolvedValue({ completed: 10, running: 2 }),
    getBullBoardInfo: jest
      .fn()
      .mockResolvedValue({ url: "http://localhost:3000/queues" }),
  };

  const mockHospitalMonitorService = {
    triggerHospitalImportByState: jest.fn().mockResolvedValue(undefined),
    scheduleDailyHospitalRefresh: jest.fn().mockResolvedValue(undefined),
    triggerPriceFileDownload: jest.fn().mockResolvedValue(undefined),
    getMonitoringStats: jest.fn().mockResolvedValue({ totalHospitals: 100 }),
  };

  const mockPraPipelineService = {
    triggerManualPRAScan: jest.fn().mockResolvedValue({ jobId: "pra-job-1" }),
    getPipelineStatus: jest.fn().mockResolvedValue({ status: "running" }),
    triggerFullPipelineRefresh: jest
      .fn()
      .mockResolvedValue({ jobId: "pra-job-2" }),
  };

  const mockHospitalsService = {
    getHospitals: jest.fn().mockResolvedValue({ hospitals: [], total: 0 }),
    getHospitalById: jest
      .fn()
      .mockResolvedValue({ id: "hospital-1", name: "Test Hospital" }),
    getHospitalPrices: jest
      .fn()
      .mockResolvedValue({ hospitalId: "hospital-1", prices: [] }),
  };

  const mockPricesService = {
    getPrices: jest.fn().mockResolvedValue({ prices: [], total: 0 }),
    comparePrices: jest
      .fn()
      .mockResolvedValue({ service: "MRI", comparisons: [] }),
    getPricingAnalytics: jest.fn().mockResolvedValue({ analytics: {} }),
    getPriceById: jest
      .fn()
      .mockResolvedValue({ id: "price-1", service: "MRI" }),
  };

  const mockAnalyticsService = {
    getDashboardAnalytics: jest.fn().mockResolvedValue({ totalHospitals: 100 }),
    getPricingTrends: jest.fn().mockResolvedValue({ trends: [] }),
    getPowerBIInfo: jest.fn().mockResolvedValue({ status: "active" }),
    exportData: jest
      .fn()
      .mockResolvedValue({ downloadUrl: "http://example.com/export.csv" }),
  };

  const mockODataService = {
    getServiceDocument: jest.fn().mockResolvedValue({ value: [] }),
    getMetadata: jest.fn().mockResolvedValue('<?xml version="1.0"?>'),
    getHospitals: jest.fn().mockResolvedValue({ value: [] }),
    getPrices: jest.fn().mockResolvedValue({ value: [] }),
    getAnalytics: jest.fn().mockResolvedValue({ value: [] }),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        JobsController,
        HospitalsController,
        PricesController,
        AnalyticsController,
        ODataController,
      ],
      providers: [
        { provide: JobsService, useValue: mockJobsService },
        {
          provide: HospitalMonitorService,
          useValue: mockHospitalMonitorService,
        },
        { provide: PRAPipelineService, useValue: mockPraPipelineService },
        { provide: HospitalsService, useValue: mockHospitalsService },
        { provide: PricesService, useValue: mockPricesService },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
        { provide: ODataService, useValue: mockODataService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Enable validation with the same settings as in main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe("Jobs Controller Validation", () => {
    describe("GET /jobs", () => {
      it("should accept valid query parameters", () => {
        return request(app.getHttpServer())
          .get("/jobs")
          .query({
            status: "completed",
            type: "hospital-import",
            limit: "10",
            offset: "0",
          })
          .expect(200);
      });

      it("should reject invalid limit (exceeds maximum)", () => {
        return request(app.getHttpServer())
          .get("/jobs")
          .query({
            limit: "101",
          })
          .expect(400);
      });

      it("should reject invalid limit (below minimum)", () => {
        return request(app.getHttpServer())
          .get("/jobs")
          .query({
            limit: "0",
          })
          .expect(400);
      });

      it("should reject invalid offset (negative)", () => {
        return request(app.getHttpServer())
          .get("/jobs")
          .query({
            offset: "-1",
          })
          .expect(400);
      });

      it("should reject non-whitelisted parameters", () => {
        return request(app.getHttpServer())
          .get("/jobs")
          .query({
            status: "completed",
            invalidParam: "value",
          })
          .expect(400);
      });
    });

    describe("POST /jobs/hospital-import", () => {
      it("should accept valid hospital import data", () => {
        return request(app.getHttpServer())
          .post("/jobs/hospital-import")
          .send({
            source: "url",
            url: "https://example.com/data.csv",
            priority: 5,
          })
          .expect(201);
      });

      it("should reject missing required source field", () => {
        return request(app.getHttpServer())
          .post("/jobs/hospital-import")
          .send({
            url: "https://example.com/data.csv",
          })
          .expect(400);
      });

      it("should reject invalid priority (exceeds maximum)", () => {
        return request(app.getHttpServer())
          .post("/jobs/hospital-import")
          .send({
            source: "url",
            priority: 11,
          })
          .expect(400);
      });

      it("should reject invalid priority (below minimum)", () => {
        return request(app.getHttpServer())
          .post("/jobs/hospital-import")
          .send({
            source: "url",
            priority: 0,
          })
          .expect(400);
      });

      it("should reject non-whitelisted properties", () => {
        return request(app.getHttpServer())
          .post("/jobs/hospital-import")
          .send({
            source: "url",
            invalidProperty: "value",
          })
          .expect(400);
      });
    });

    describe("POST /jobs/price-update", () => {
      it("should accept valid price update data", () => {
        return request(app.getHttpServer())
          .post("/jobs/price-update")
          .send({
            hospitalId: "123e4567-e89b-12d3-a456-426614174000",
            priority: 7,
          })
          .expect(201);
      });

      it("should accept empty body", () => {
        return request(app.getHttpServer())
          .post("/jobs/price-update")
          .send({})
          .expect(201);
      });

      it("should reject invalid priority (exceeds maximum)", () => {
        return request(app.getHttpServer())
          .post("/jobs/price-update")
          .send({
            priority: 11,
          })
          .expect(400);
      });

      it("should reject non-string hospitalId", () => {
        return request(app.getHttpServer())
          .post("/jobs/price-update")
          .send({
            hospitalId: 123,
          })
          .expect(400);
      });
    });

    describe("POST /jobs/pra/scan", () => {
      it("should accept valid PRA scan data", () => {
        return request(app.getHttpServer())
          .post("/jobs/pra/scan")
          .send({
            testMode: true,
            forceRefresh: false,
          })
          .expect(201);
      });

      it("should accept empty body", () => {
        return request(app.getHttpServer())
          .post("/jobs/pra/scan")
          .send({})
          .expect(201);
      });

      it("should reject non-boolean testMode", () => {
        return request(app.getHttpServer())
          .post("/jobs/pra/scan")
          .send({
            testMode: "true",
          })
          .expect(400);
      });

      it("should reject non-boolean forceRefresh", () => {
        return request(app.getHttpServer())
          .post("/jobs/pra/scan")
          .send({
            forceRefresh: 1,
          })
          .expect(400);
      });
    });

    describe("POST /jobs/hospitals/import", () => {
      it("should accept valid hospital import data", () => {
        return request(app.getHttpServer())
          .post("/jobs/hospitals/import")
          .send({
            state: "CA",
            forceRefresh: true,
            batchSize: 50,
          })
          .expect(201);
      });

      it("should reject invalid batchSize (exceeds maximum)", () => {
        return request(app.getHttpServer())
          .post("/jobs/hospitals/import")
          .send({
            batchSize: 101,
          })
          .expect(400);
      });

      it("should reject invalid batchSize (below minimum)", () => {
        return request(app.getHttpServer())
          .post("/jobs/hospitals/import")
          .send({
            batchSize: 0,
          })
          .expect(400);
      });
    });

    describe("POST /jobs/hospitals/:hospitalId/files/:fileId/download", () => {
      it("should accept valid price file download data", () => {
        return request(app.getHttpServer())
          .post("/jobs/hospitals/hospital-123/files/file-456/download")
          .send({
            forceReprocess: true,
          })
          .expect(201);
      });

      it("should reject non-boolean forceReprocess", () => {
        return request(app.getHttpServer())
          .post("/jobs/hospitals/hospital-123/files/file-456/download")
          .send({
            forceReprocess: "true",
          })
          .expect(400);
      });
    });
  });

  describe("Hospitals Controller Validation", () => {
    describe("GET /hospitals", () => {
      it("should accept valid query parameters", () => {
        return request(app.getHttpServer())
          .get("/hospitals")
          .query({
            state: "CA",
            city: "Los Angeles",
            limit: "20",
            offset: "10",
          })
          .expect(200);
      });

      it("should reject invalid limit (exceeds maximum)", () => {
        return request(app.getHttpServer())
          .get("/hospitals")
          .query({
            limit: "101",
          })
          .expect(400);
      });

      it("should reject invalid offset (negative)", () => {
        return request(app.getHttpServer())
          .get("/hospitals")
          .query({
            offset: "-1",
          })
          .expect(400);
      });

      it("should reject non-whitelisted parameters", () => {
        return request(app.getHttpServer())
          .get("/hospitals")
          .query({
            state: "CA",
            invalidParam: "value",
          })
          .expect(400);
      });
    });
  });

  describe("Prices Controller Validation", () => {
    describe("GET /prices", () => {
      it("should accept valid query parameters", () => {
        return request(app.getHttpServer())
          .get("/prices")
          .query({
            hospital: "123e4567-e89b-12d3-a456-426614174000",
            service: "MRI",
            state: "CA",
            minPrice: "100",
            maxPrice: "1000",
            limit: "50",
            offset: "0",
          })
          .expect(200);
      });

      it("should reject invalid minPrice (negative)", () => {
        return request(app.getHttpServer())
          .get("/prices")
          .query({
            minPrice: "-10",
          })
          .expect(400);
      });

      it("should reject invalid maxPrice (negative)", () => {
        return request(app.getHttpServer())
          .get("/prices")
          .query({
            maxPrice: "-50",
          })
          .expect(400);
      });

      it("should reject invalid limit (exceeds maximum)", () => {
        return request(app.getHttpServer())
          .get("/prices")
          .query({
            limit: "101",
          })
          .expect(400);
      });
    });

    describe("GET /prices/compare", () => {
      it("should accept valid query parameters", () => {
        return request(app.getHttpServer())
          .get("/prices/compare")
          .query({
            service: "MRI",
            state: "CA",
            limit: "10",
          })
          .expect(200);
      });

      it("should reject missing required service field", () => {
        return request(app.getHttpServer())
          .get("/prices/compare")
          .query({
            state: "CA",
          })
          .expect(400);
      });

      it("should reject invalid limit (exceeds maximum)", () => {
        return request(app.getHttpServer())
          .get("/prices/compare")
          .query({
            service: "MRI",
            limit: "51",
          })
          .expect(400);
      });

      it("should reject invalid limit (below minimum)", () => {
        return request(app.getHttpServer())
          .get("/prices/compare")
          .query({
            service: "MRI",
            limit: "0",
          })
          .expect(400);
      });
    });

    describe("GET /prices/analytics", () => {
      it("should accept valid query parameters", () => {
        return request(app.getHttpServer())
          .get("/prices/analytics")
          .query({
            service: "MRI",
            state: "CA",
            period: "30d",
          })
          .expect(200);
      });

      it("should reject invalid period value", () => {
        return request(app.getHttpServer())
          .get("/prices/analytics")
          .query({
            period: "7d",
          })
          .expect(400);
      });
    });
  });

  describe("Analytics Controller Validation", () => {
    describe("GET /analytics/trends", () => {
      it("should accept valid query parameters", () => {
        return request(app.getHttpServer())
          .get("/analytics/trends")
          .query({
            service: "MRI",
            state: "CA",
            period: "90d",
          })
          .expect(200);
      });

      it("should reject invalid period value", () => {
        return request(app.getHttpServer())
          .get("/analytics/trends")
          .query({
            period: "14d",
          })
          .expect(400);
      });
    });

    describe("GET /analytics/export", () => {
      it("should accept valid query parameters", () => {
        return request(app.getHttpServer())
          .get("/analytics/export")
          .query({
            format: "csv",
            dataset: "hospitals",
          })
          .expect(200);
      });

      it("should reject invalid format value", () => {
        return request(app.getHttpServer())
          .get("/analytics/export")
          .query({
            format: "pdf",
          })
          .expect(400);
      });

      it("should reject invalid dataset value", () => {
        return request(app.getHttpServer())
          .get("/analytics/export")
          .query({
            dataset: "users",
          })
          .expect(400);
      });
    });
  });

  describe("OData Controller Validation", () => {
    describe("GET /odata/hospitals", () => {
      it("should accept valid OData query parameters", () => {
        return request(app.getHttpServer())
          .get("/odata/hospitals")
          .query({
            $select: "id,name,state",
            $filter: "state eq 'CA'",
            $orderby: "name asc",
            $top: "10",
            $skip: "0",
            $count: "true",
          })
          .expect(200);
      });

      it("should reject non-string $top parameter", () => {
        return request(app.getHttpServer())
          .get("/odata/hospitals")
          .query({
            $top: 10,
          })
          .expect(400);
      });

      it("should reject non-string $skip parameter", () => {
        return request(app.getHttpServer())
          .get("/odata/hospitals")
          .query({
            $skip: 5,
          })
          .expect(400);
      });

      it("should reject non-string $count parameter", () => {
        return request(app.getHttpServer())
          .get("/odata/hospitals")
          .query({
            $count: true,
          })
          .expect(400);
      });

      it("should reject non-whitelisted parameters", () => {
        return request(app.getHttpServer())
          .get("/odata/hospitals")
          .query({
            $select: "id,name",
            invalidParam: "value",
          })
          .expect(400);
      });
    });

    describe("GET /odata/prices", () => {
      it("should accept valid OData query parameters", () => {
        return request(app.getHttpServer())
          .get("/odata/prices")
          .query({
            $select: "id,service,price",
            $filter: "price gt 500",
            $orderby: "price desc",
            $top: "15",
            $skip: "5",
            $count: "true",
          })
          .expect(200);
      });
    });

    describe("GET /odata/analytics", () => {
      it("should accept valid OData query parameters", () => {
        return request(app.getHttpServer())
          .get("/odata/analytics")
          .query({
            $select: "id,metric,value",
            $filter: "metric eq 'average_price'",
            $orderby: "value desc",
            $top: "10",
            $skip: "0",
            $count: "true",
          })
          .expect(200);
      });
    });
  });

  describe("Edge Cases and Error Scenarios", () => {
    describe("Type Transformation", () => {
      it("should transform string numbers to numbers in price queries", () => {
        return request(app.getHttpServer())
          .get("/prices")
          .query({
            minPrice: "100",
            maxPrice: "1000",
            limit: "25",
            offset: "10",
          })
          .expect(200);
      });

      it("should transform string numbers to numbers in job queries", () => {
        return request(app.getHttpServer())
          .get("/jobs")
          .query({
            limit: "50",
            offset: "25",
          })
          .expect(200);
      });
    });

    describe("Boundary Values", () => {
      it("should accept limit at minimum boundary (1)", () => {
        return request(app.getHttpServer())
          .get("/jobs")
          .query({
            limit: "1",
          })
          .expect(200);
      });

      it("should accept limit at maximum boundary (100)", () => {
        return request(app.getHttpServer())
          .get("/jobs")
          .query({
            limit: "100",
          })
          .expect(200);
      });

      it("should accept offset at minimum boundary (0)", () => {
        return request(app.getHttpServer())
          .get("/jobs")
          .query({
            offset: "0",
          })
          .expect(200);
      });

      it("should accept priority at minimum boundary (1)", () => {
        return request(app.getHttpServer())
          .post("/jobs/hospital-import")
          .send({
            source: "url",
            priority: 1,
          })
          .expect(201);
      });

      it("should accept priority at maximum boundary (10)", () => {
        return request(app.getHttpServer())
          .post("/jobs/hospital-import")
          .send({
            source: "url",
            priority: 10,
          })
          .expect(201);
      });

      it("should accept batchSize at minimum boundary (1)", () => {
        return request(app.getHttpServer())
          .post("/jobs/hospitals/import")
          .send({
            batchSize: 1,
          })
          .expect(201);
      });

      it("should accept batchSize at maximum boundary (100)", () => {
        return request(app.getHttpServer())
          .post("/jobs/hospitals/import")
          .send({
            batchSize: 100,
          })
          .expect(201);
      });

      it("should accept comparison limit at minimum boundary (1)", () => {
        return request(app.getHttpServer())
          .get("/prices/compare")
          .query({
            service: "MRI",
            limit: "1",
          })
          .expect(200);
      });

      it("should accept comparison limit at maximum boundary (50)", () => {
        return request(app.getHttpServer())
          .get("/prices/compare")
          .query({
            service: "MRI",
            limit: "50",
          })
          .expect(200);
      });
    });

    describe("Invalid Data Types", () => {
      it("should reject non-numeric string for limit", () => {
        return request(app.getHttpServer())
          .get("/jobs")
          .query({
            limit: "invalid",
          })
          .expect(400);
      });

      it("should reject non-numeric string for offset", () => {
        return request(app.getHttpServer())
          .get("/jobs")
          .query({
            offset: "invalid",
          })
          .expect(400);
      });

      it("should reject non-numeric string for price", () => {
        return request(app.getHttpServer())
          .get("/prices")
          .query({
            minPrice: "invalid",
          })
          .expect(400);
      });

      it("should reject array for string field", () => {
        return request(app.getHttpServer())
          .get("/hospitals")
          .query({
            state: ["CA", "TX"],
          })
          .expect(400);
      });

      it("should reject object for string field", () => {
        return request(app.getHttpServer())
          .post("/jobs/hospital-import")
          .send({
            source: { type: "url" },
          })
          .expect(400);
      });
    });
  });
});
