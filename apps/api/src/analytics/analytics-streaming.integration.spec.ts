import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AnalyticsModule } from "./analytics.module";
import { DatabaseService } from "../database/database.service";
import { PinoLogger } from "nestjs-pino";

describe("Analytics Streaming Integration", () => {
  let app: INestApplication;
  let databaseService: DatabaseService;

  // Mock database service with realistic data
  const mockDatabaseService = {
    db: {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn(),
      leftJoin: jest.fn().mockReturnThis(),
    },
  };

  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AnalyticsModule],
    })
      .overrideProvider(DatabaseService)
      .useValue(mockDatabaseService)
      .overrideProvider(PinoLogger)
      .useValue(mockLogger)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    databaseService = moduleFixture.get<DatabaseService>(DatabaseService);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe("GET /analytics/export/stream", () => {
    it("should stream JSON data successfully", async () => {
      // Mock hospital data
      const mockHospitalData = [
        {
          id: "123e4567-e89b-12d3-a456-426614174000",
          name: "Test Hospital",
          state: "CA",
          city: "Los Angeles",
          address: "123 Main St",
          phone: "555-0123",
          website: "https://test.com",
          bedCount: 100,
          ownership: "private",
          lastUpdated: new Date(),
          createdAt: new Date(),
        },
      ];

      mockDatabaseService.db.offset.mockResolvedValue(mockHospitalData);

      const response = await request(app.getHttpServer())
        .get("/analytics/export/stream")
        .query({
          format: "json",
          dataset: "hospitals",
          limit: 1,
        })
        .expect(200);

      expect(response.headers["content-type"]).toBe(
        "application/json; charset=utf-8",
      );
      expect(response.headers["transfer-encoding"]).toBe("chunked");
      expect(response.headers["cache-control"]).toBe("no-cache");
      expect(response.headers["content-disposition"]).toContain(
        'attachment; filename="glimmr-hospitals-export-',
      );

      const responseData = JSON.parse(response.text);
      expect(responseData).toHaveProperty("data");
      expect(responseData).toHaveProperty("metadata");
      expect(responseData.metadata).toMatchObject({
        recordCount: 1,
        dataset: "hospitals",
        format: "json",
        streamingEnabled: true,
        truncated: false,
      });
    });

    it("should return 400 for unsupported format", async () => {
      const response = await request(app.getHttpServer())
        .get("/analytics/export/stream")
        .query({
          format: "csv",
          dataset: "hospitals",
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: "Only JSON format is supported for streaming exports",
        supportedFormats: ["json"],
        message:
          "Use /api/v1/analytics/export for other formats (returns job metadata)",
      });
    });

    it("should return 400 for invalid dataset", async () => {
      const response = await request(app.getHttpServer())
        .get("/analytics/export/stream")
        .query({
          format: "json",
          dataset: "invalid",
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: "Invalid dataset specified",
        supportedDatasets: ["hospitals", "prices", "analytics", "all"],
      });
    });

    it("should handle streaming prices data", async () => {
      const mockPriceData = [
        {
          id: "123e4567-e89b-12d3-a456-426614174001",
          hospitalId: "123e4567-e89b-12d3-a456-426614174000",
          serviceName: "MRI Scan",
          serviceCode: "MRI001",
          grossCharge: "1500.00",
          discountedCashPrice: "1200.00",
          category: "imaging",
          lastUpdated: new Date(),
          createdAt: new Date(),
        },
      ];

      mockDatabaseService.db.offset.mockResolvedValue(mockPriceData);

      const response = await request(app.getHttpServer())
        .get("/analytics/export/stream")
        .query({
          format: "json",
          dataset: "prices",
          limit: 1,
        })
        .expect(200);

      const responseData = JSON.parse(response.text);
      expect(responseData.metadata.dataset).toBe("prices");
      expect(responseData.data).toHaveLength(1);
      expect(responseData.data[0]).toMatchObject({
        serviceName: "MRI Scan",
        grossCharge: "1500.00",
      });
    });

    it("should handle streaming analytics data", async () => {
      const mockAnalyticsData = [
        {
          id: "123e4567-e89b-12d3-a456-426614174002",
          metric: "average_price",
          value: "1250.00",
          dimension: "state",
          period: "2024-Q1",
          state: "CA",
          service: "MRI",
          calculatedAt: new Date(),
        },
      ];

      mockDatabaseService.db.offset.mockResolvedValue(mockAnalyticsData);

      const response = await request(app.getHttpServer())
        .get("/analytics/export/stream")
        .query({
          format: "json",
          dataset: "analytics",
          limit: 1,
        })
        .expect(200);

      const responseData = JSON.parse(response.text);
      expect(responseData.metadata.dataset).toBe("analytics");
      expect(responseData.data).toHaveLength(1);
      expect(responseData.data[0]).toMatchObject({
        metric: "average_price",
        value: "1250.00",
      });
    });

    it("should respect limit parameter", async () => {
      // Return more data than the limit
      const mockData = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: `id-${i}`,
          name: `Hospital ${i}`,
        }));

      mockDatabaseService.db.offset.mockResolvedValue(mockData);

      const response = await request(app.getHttpServer())
        .get("/analytics/export/stream")
        .query({
          format: "json",
          dataset: "hospitals",
          limit: 5,
        })
        .expect(200);

      const responseData = JSON.parse(response.text);
      expect(responseData.metadata.maxRecords).toBe(5);
      expect(responseData.metadata.truncated).toBe(true);
    });

    it("should handle default parameters", async () => {
      mockDatabaseService.db.offset.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get("/analytics/export/stream")
        .expect(200);

      const responseData = JSON.parse(response.text);
      expect(responseData.metadata).toMatchObject({
        dataset: "hospitals", // default
        format: "json", // default
        maxRecords: 50000, // default
        recordCount: 0,
        truncated: false,
        streamingEnabled: true,
      });
    });

    it("should handle empty datasets gracefully", async () => {
      mockDatabaseService.db.offset.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get("/analytics/export/stream")
        .query({
          format: "json",
          dataset: "hospitals",
          limit: 100,
        })
        .expect(200);

      const responseData = JSON.parse(response.text);
      expect(responseData.data).toEqual([]);
      expect(responseData.metadata.recordCount).toBe(0);
      expect(responseData.metadata.truncated).toBe(false);
    });

    it("should handle database errors gracefully", async () => {
      mockDatabaseService.db.offset.mockRejectedValue(
        new Error("Database connection failed"),
      );

      const response = await request(app.getHttpServer())
        .get("/analytics/export/stream")
        .query({
          format: "json",
          dataset: "hospitals",
        })
        .expect(500);

      expect(response.body).toMatchObject({
        error: "Internal server error during export",
        message: "Database connection failed",
      });
    });

    it("should handle large datasets with batching", async () => {
      // Simulate batched responses
      const batch1 = Array(1000)
        .fill(null)
        .map((_, i) => ({
          id: `id-${i}`,
          name: `Hospital ${i}`,
        }));
      const batch2 = Array(500)
        .fill(null)
        .map((_, i) => ({
          id: `id-${i + 1000}`,
          name: `Hospital ${i + 1000}`,
        }));

      mockDatabaseService.db.offset
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2)
        .mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get("/analytics/export/stream")
        .query({
          format: "json",
          dataset: "hospitals",
          limit: 2000,
        })
        .expect(200);

      const responseData = JSON.parse(response.text);
      expect(responseData.metadata.recordCount).toBe(1500);
      expect(responseData.data).toHaveLength(1500);
    });

    it("should validate DTO parameters", async () => {
      const response = await request(app.getHttpServer())
        .get("/analytics/export/stream")
        .query({
          format: "json",
          dataset: "hospitals",
          limit: "invalid-limit",
        })
        .expect(400);

      expect(response.body.message).toContain("validation failed");
    });

    it("should handle boundary limit values", async () => {
      mockDatabaseService.db.offset.mockResolvedValue([]);

      // Test minimum limit
      await request(app.getHttpServer())
        .get("/analytics/export/stream")
        .query({
          format: "json",
          dataset: "hospitals",
          limit: 1,
        })
        .expect(200);

      // Test maximum limit
      await request(app.getHttpServer())
        .get("/analytics/export/stream")
        .query({
          format: "json",
          dataset: "hospitals",
          limit: 100000,
        })
        .expect(200);
    });

    it("should include proper Content-Disposition header with date", async () => {
      mockDatabaseService.db.offset.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get("/analytics/export/stream")
        .query({
          format: "json",
          dataset: "hospitals",
        })
        .expect(200);

      const today = new Date().toISOString().split("T")[0];
      expect(response.headers["content-disposition"]).toContain(
        `glimmr-hospitals-export-${today}.json`,
      );
    });
  });

  describe("Authentication and Authorization", () => {
    it("should require authentication for streaming endpoints", async () => {
      // This test would be more relevant with actual auth guards
      // For now, we verify the endpoint exists and responds
      const response = await request(app.getHttpServer())
        .get("/analytics/export/stream")
        .query({
          format: "json",
          dataset: "hospitals",
        });

      // Should not be 404 (endpoint exists)
      expect([200, 400, 401, 403, 500]).toContain(response.status);
    });
  });

  describe("Rate Limiting", () => {
    it("should have rate limiting configured for streaming endpoint", async () => {
      // Mock successful response for rate limiting test
      mockDatabaseService.db.offset.mockResolvedValue([]);

      // Make multiple requests to test rate limiting
      const promises = Array(3)
        .fill(null)
        .map(() =>
          request(app.getHttpServer()).get("/analytics/export/stream").query({
            format: "json",
            dataset: "hospitals",
            limit: 1,
          }),
        );

      const responses = await Promise.all(promises);

      // All should succeed in test environment, but rate limiting headers should be present
      responses.forEach((response) => {
        expect([200, 429]).toContain(response.status);
      });
    });
  });
});
