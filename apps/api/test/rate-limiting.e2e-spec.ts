import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import * as request from "supertest";
import { AnalyticsController } from "../src/analytics/analytics.controller";
import { AnalyticsService } from "../src/analytics/analytics.service";
import { JobsController } from "../src/jobs/jobs.controller";
import { JobsService } from "../src/jobs/jobs.service";
import { HospitalMonitorService } from "../src/jobs/services/hospital-monitor.service";
import { PRAPipelineService } from "../src/jobs/services/pra-pipeline.service";
import { ODataController } from "../src/odata/odata.controller";
import { ODataService } from "../src/odata/odata.service";
import { CustomThrottlerGuard } from "../src/common/guards/custom-throttler.guard";

describe("Rate Limiting (e2e)", () => {
  let app: INestApplication;
  let analyticsService: AnalyticsService;
  let jobsService: JobsService;
  let odataService: ODataService;

  const mockAnalyticsService = {
    getDashboardAnalytics: jest.fn().mockResolvedValue({ totalHospitals: 100 }),
    getPricingTrends: jest.fn().mockResolvedValue([]),
    getPowerBIInfo: jest.fn().mockResolvedValue({ datasets: [] }),
    exportData: jest.fn().mockResolvedValue({ downloadUrl: "test.csv" }),
  };

  const mockJobsService = {
    getJobs: jest.fn().mockResolvedValue([]),
    getJobStats: jest.fn().mockResolvedValue({ active: 0 }),
    getBullBoardInfo: jest.fn().mockResolvedValue({ url: "/admin" }),
    startHospitalImport: jest.fn().mockResolvedValue({ jobId: "test123" }),
    startPriceUpdate: jest.fn().mockResolvedValue({ jobId: "update123" }),
    getJobById: jest
      .fn()
      .mockResolvedValue({ id: "test", status: "completed" }),
  };

  const mockHospitalMonitorService = {
    triggerHospitalImportByState: jest.fn().mockResolvedValue(undefined),
    scheduleDailyHospitalRefresh: jest.fn().mockResolvedValue(undefined),
    triggerPriceFileDownload: jest.fn().mockResolvedValue(undefined),
    getMonitoringStats: jest.fn().mockResolvedValue({ queues: {} }),
  };

  const mockPRAPipelineService = {
    triggerManualPRAScan: jest.fn().mockResolvedValue({ jobId: "pra123" }),
    getPipelineStatus: jest.fn().mockResolvedValue({ running: false }),
    triggerFullPipelineRefresh: jest
      .fn()
      .mockResolvedValue({ jobId: "refresh123" }),
  };

  const mockODataService = {
    getServiceDocument: jest.fn().mockResolvedValue({ value: [] }),
    getMetadata: jest.fn().mockResolvedValue("<edmx:Edmx></edmx:Edmx>"),
    getHospitals: jest.fn().mockResolvedValue({ value: [] }),
    getPrices: jest.fn().mockResolvedValue({ value: [] }),
    getAnalytics: jest.fn().mockResolvedValue({ value: [] }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: [".env.test", ".env"],
        }),
        ThrottlerModule.forRoot([
          {
            name: "default",
            ttl: 1000, // 1 second for testing
            limit: 5, // Low limit for testing
          },
          {
            name: "expensive",
            ttl: 1000, // 1 second for testing
            limit: 2, // Very low limit for testing
          },
        ]),
      ],
      controllers: [AnalyticsController, JobsController, ODataController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
        {
          provide: JobsService,
          useValue: mockJobsService,
        },
        {
          provide: HospitalMonitorService,
          useValue: mockHospitalMonitorService,
        },
        {
          provide: PRAPipelineService,
          useValue: mockPRAPipelineService,
        },
        {
          provide: ODataService,
          useValue: mockODataService,
        },
        {
          provide: APP_GUARD,
          useClass: CustomThrottlerGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    analyticsService = moduleFixture.get<AnalyticsService>(AnalyticsService);
    jobsService = moduleFixture.get<JobsService>(JobsService);
    odataService = moduleFixture.get<ODataService>(ODataService);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Rate Limit Headers", () => {
    it("should include rate limit headers in responses", async () => {
      const response = await request(app.getHttpServer())
        .get("/analytics/powerbi")
        .expect(200);

      expect(response.headers["x-ratelimit-limit"]).toBeDefined();
      expect(response.headers["x-ratelimit-window"]).toBeDefined();
    });

    it("should include rate limit headers on throttled endpoints", async () => {
      const response = await request(app.getHttpServer())
        .get("/analytics/dashboard")
        .expect(200);

      expect(response.headers["x-ratelimit-limit"]).toBeDefined();
      expect(response.headers["x-ratelimit-window"]).toBeDefined();
    });
  });

  describe("Default Rate Limiting (5 req/1sec)", () => {
    beforeEach(async () => {
      // Wait for rate limit window to reset
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    it("should allow requests within limit", async () => {
      // Make requests within the limit
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .get("/analytics/powerbi")
          .expect(200);
      }
    });

    it("should throttle requests exceeding limit", async () => {
      // Fill up the rate limit
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .get("/analytics/powerbi")
          .expect(200);
      }

      // Next request should be throttled
      await request(app.getHttpServer()).get("/analytics/powerbi").expect(429); // Too Many Requests
    });

    it("should reset rate limit after TTL expires", async () => {
      // Fill up the rate limit
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .get("/analytics/powerbi")
          .expect(200);
      }

      // Should be throttled
      await request(app.getHttpServer()).get("/analytics/powerbi").expect(429);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should work again
      await request(app.getHttpServer()).get("/analytics/powerbi").expect(200);
    });
  });

  describe("Expensive Operations Rate Limiting (2 req/1sec)", () => {
    beforeEach(async () => {
      // Wait for rate limit window to reset
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    it("should allow requests within expensive limit", async () => {
      // Make requests within the expensive limit
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer())
          .get("/analytics/dashboard")
          .expect(200);
      }
    });

    it("should throttle expensive operations more aggressively", async () => {
      // Fill up the expensive rate limit (only 2 requests)
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer())
          .get("/analytics/dashboard")
          .expect(200);
      }

      // Next request should be throttled
      await request(app.getHttpServer())
        .get("/analytics/dashboard")
        .expect(429);
    });

    it("should throttle analytics export endpoint", async () => {
      // Fill up the expensive rate limit
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer()).get("/analytics/export").expect(200);
      }

      // Should be throttled
      await request(app.getHttpServer()).get("/analytics/export").expect(429);
    });

    it("should throttle analytics trends endpoint", async () => {
      // Fill up the expensive rate limit
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer()).get("/analytics/trends").expect(200);
      }

      // Should be throttled
      await request(app.getHttpServer()).get("/analytics/trends").expect(429);
    });
  });

  describe("OData Endpoints Rate Limiting", () => {
    beforeEach(async () => {
      // Wait for rate limit window to reset
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    it("should throttle prices endpoint (most restrictive)", async () => {
      // Fill up the expensive rate limit
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer()).get("/odata/prices").expect(200);
      }

      // Should be throttled
      await request(app.getHttpServer()).get("/odata/prices").expect(429);
    });

    it("should throttle analytics endpoint", async () => {
      // Fill up the expensive rate limit
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer()).get("/odata/analytics").expect(200);
      }

      // Should be throttled
      await request(app.getHttpServer()).get("/odata/analytics").expect(429);
    });

    it("should throttle hospitals endpoint", async () => {
      // Fill up the expensive rate limit
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer()).get("/odata/hospitals").expect(200);
      }

      // Should be throttled
      await request(app.getHttpServer()).get("/odata/hospitals").expect(429);
    });

    it("should NOT throttle metadata endpoints", async () => {
      // Metadata endpoints should use default throttling
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).get("/odata").expect(200);
      }

      // Should be throttled after default limit
      await request(app.getHttpServer()).get("/odata").expect(429);
    });
  });

  describe("Jobs Endpoints Rate Limiting", () => {
    beforeEach(async () => {
      // Wait for rate limit window to reset
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    it("should throttle POST endpoints more than GET endpoints", async () => {
      // GET endpoints should use default throttling (5 requests)
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).get("/jobs").expect(200);
      }

      await request(app.getHttpServer()).get("/jobs").expect(429);

      // Wait for reset
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // POST endpoints should use expensive throttling (2 requests)
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer())
          .post("/jobs/hospital-import")
          .send({})
          .expect(201);
      }

      await request(app.getHttpServer())
        .post("/jobs/hospital-import")
        .send({})
        .expect(429);
    });

    it("should throttle PRA scan endpoint most restrictively", async () => {
      // Fill up the expensive rate limit quickly
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer())
          .post("/jobs/pra/scan")
          .send({})
          .expect(201);
      }

      // Should be throttled
      await request(app.getHttpServer())
        .post("/jobs/pra/scan")
        .send({})
        .expect(429);
    });

    it("should throttle full refresh endpoint", async () => {
      // Fill up the expensive rate limit
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer())
          .post("/jobs/pra/full-refresh")
          .send()
          .expect(201);
      }

      // Should be throttled
      await request(app.getHttpServer())
        .post("/jobs/pra/full-refresh")
        .send()
        .expect(429);
    });
  });

  describe("Different Client Identification", () => {
    beforeEach(async () => {
      // Wait for rate limit window to reset
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    it("should track different IPs separately", async () => {
      // First IP fills up the limit
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .get("/analytics/powerbi")
          .set("X-Forwarded-For", "192.168.1.1")
          .expect(200);
      }

      // First IP should be throttled
      await request(app.getHttpServer())
        .get("/analytics/powerbi")
        .set("X-Forwarded-For", "192.168.1.1")
        .expect(429);

      // Different IP should still work
      await request(app.getHttpServer())
        .get("/analytics/powerbi")
        .set("X-Forwarded-For", "192.168.1.2")
        .expect(200);
    });

    it("should handle proxy headers correctly", async () => {
      // Use X-Forwarded-For header with multiple IPs
      await request(app.getHttpServer())
        .get("/analytics/powerbi")
        .set("X-Forwarded-For", "203.0.113.195, 192.168.1.1, 10.0.0.1")
        .expect(200);

      // Should use the first IP (203.0.113.195) for rate limiting
      for (let i = 0; i < 4; i++) {
        await request(app.getHttpServer())
          .get("/analytics/powerbi")
          .set("X-Forwarded-For", "203.0.113.195, 10.0.0.2")
          .expect(200);
      }

      // Should be throttled
      await request(app.getHttpServer())
        .get("/analytics/powerbi")
        .set("X-Forwarded-For", "203.0.113.195, 10.0.0.3")
        .expect(429);
    });
  });

  describe("Error Responses and Headers", () => {
    beforeEach(async () => {
      // Wait for rate limit window to reset
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    it("should include retry-after header when rate limited", async () => {
      // Fill up the rate limit
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .get("/analytics/powerbi")
          .expect(200);
      }

      // Check throttled response
      const response = await request(app.getHttpServer())
        .get("/analytics/powerbi")
        .expect(429);

      expect(response.headers["retry-after"]).toBeDefined();
    });

    it("should return proper error format when throttled", async () => {
      // Fill up the rate limit
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer())
          .get("/analytics/dashboard")
          .expect(200);
      }

      // Check throttled response format
      const response = await request(app.getHttpServer())
        .get("/analytics/dashboard")
        .expect(429);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("statusCode", 429);
    });
  });

  describe("Performance Under Load", () => {
    beforeEach(async () => {
      // Wait for rate limit window to reset
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    it("should handle concurrent requests correctly", async () => {
      // Make concurrent requests
      const promises = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .get("/analytics/powerbi")
          .catch((err) => ({ status: err.status })),
      );

      const responses = await Promise.all(promises);

      // Should have 5 successful (200) and 5 throttled (429)
      const successCount = responses.filter((r) => r.status === 200).length;
      const throttledCount = responses.filter((r) => r.status === 429).length;

      expect(successCount).toBeLessThanOrEqual(5);
      expect(throttledCount).toBeGreaterThan(0);
    });

    it("should maintain rate limiting accuracy under burst requests", async () => {
      // Burst requests to expensive endpoint
      const promises = Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .get("/analytics/dashboard")
          .catch((err) => ({ status: err.status })),
      );

      const responses = await Promise.all(promises);

      // Should have 2 successful (200) and 3 throttled (429)
      const successCount = responses.filter((r) => r.status === 200).length;
      const throttledCount = responses.filter((r) => r.status === 429).length;

      expect(successCount).toBeLessThanOrEqual(2);
      expect(throttledCount).toBeGreaterThan(0);
    });
  });

  describe("Mixed Endpoint Testing", () => {
    beforeEach(async () => {
      // Wait for rate limit window to reset
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    it("should apply different limits to different endpoint types", async () => {
      // Default throttling endpoint
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).get("/jobs/stats").expect(200);
      }

      // Should be throttled
      await request(app.getHttpServer()).get("/jobs/stats").expect(429);

      // Wait for reset
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Expensive throttling endpoint (lower limit)
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer())
          .get("/analytics/dashboard")
          .expect(200);
      }

      // Should be throttled after fewer requests
      await request(app.getHttpServer())
        .get("/analytics/dashboard")
        .expect(429);
    });
  });
});
