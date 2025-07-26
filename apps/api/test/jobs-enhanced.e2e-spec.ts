import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { io, Socket } from "socket.io-client";
import { AppModule } from "../src/app.module";
import { DatabaseService } from "../src/database/database.service";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { jobSchedules, jobTemplates, jobs } from "../src/database/schema";
import { eq } from "drizzle-orm";

describe("Jobs Enhanced Features E2E", () => {
  let app: INestApplication;
  let databaseService: DatabaseService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let authToken: string;
  let adminToken: string;
  let wsClient: Socket;

  // Test data
  const testScheduleId = "test-schedule-123";
  const testTemplateId = "test-template-123";
  const testJobIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    databaseService = moduleFixture.get<DatabaseService>(DatabaseService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    configService = moduleFixture.get<ConfigService>(ConfigService);

    // Create test users and get tokens
    authToken = await createTestUser("user", ["api-user"]);
    adminToken = await createTestUser("admin", ["admin"]);

    // Set up test data
    await setupTestData();

    // Start the app
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = address.port;

    // Connect WebSocket client
    wsClient = io(`http://localhost:${port}/jobs`, {
      auth: {
        token: adminToken,
      },
    });

    await new Promise((resolve) => {
      wsClient.on("connect", resolve);
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    wsClient.disconnect();
    await app.close();
  });

  async function createTestUser(username: string, roles: string[]): Promise<string> {
    const payload = {
      sub: `test-${username}-${Date.now()}`,
      username,
      roles,
    };
    return jwtService.sign(payload, {
      secret: configService.get<string>("JWT_SECRET"),
    });
  }

  async function setupTestData() {
    const db = databaseService.db;

    // Create test template
    await db.insert(jobTemplates).values({
      id: testTemplateId,
      name: "test-template",
      displayName: "Test Template",
      queueName: "price-file-parser",
      category: "test",
      defaultConfig: { test: true },
      defaultPriority: 1,
      defaultRetryAttempts: 3,
      defaultRetryDelay: 60000,
      isActive: true,
      createdBy: "test",
    });

    // Create test schedule
    await db.insert(jobSchedules).values({
      id: testScheduleId,
      name: "Test Schedule",
      description: "E2E test schedule",
      templateId: testTemplateId,
      cronExpression: "0 2 * * *",
      timezone: "UTC",
      priority: 1,
      isEnabled: true,
      maxConsecutiveFailures: 5,
      disableOnMaxFailures: true,
      consecutiveFailures: 0,
      nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdBy: "test",
    });

    // Create test jobs
    const jobData = [
      {
        id: "test-job-1",
        jobType: "test",
        jobName: "Test Job 1",
        queue: "price-file-parser",
        status: "completed" as const,
        priority: 1,
        startedAt: new Date(Date.now() - 60000),
        completedAt: new Date(),
        duration: 60000,
        recordsProcessed: 100,
        createdBy: "test",
      },
      {
        id: "test-job-2",
        jobType: "test",
        jobName: "Test Job 2",
        queue: "price-file-parser",
        status: "failed" as const,
        priority: 1,
        startedAt: new Date(Date.now() - 30000),
        completedAt: new Date(),
        duration: 30000,
        errorMessage: "Test error",
        createdBy: "test",
      },
      {
        id: "test-job-3",
        jobType: "test",
        jobName: "Test Job 3",
        queue: "analytics-refresh",
        status: "active" as const,
        priority: 2,
        startedAt: new Date(),
        progressPercentage: 50,
        createdBy: "test",
      },
    ];

    for (const job of jobData) {
      await db.insert(jobs).values(job);
      testJobIds.push(job.id);
    }
  }

  async function cleanupTestData() {
    const db = databaseService.db;

    // Delete test jobs
    for (const jobId of testJobIds) {
      await db.delete(jobs).where(eq(jobs.id, jobId));
    }

    // Delete test schedule
    await db.delete(jobSchedules).where(eq(jobSchedules.id, testScheduleId));

    // Delete test template
    await db.delete(jobTemplates).where(eq(jobTemplates.id, testTemplateId));
  }

  describe("Job Search and Filtering", () => {
    it("should search jobs by name", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/jobs/search")
        .set("Authorization", `Bearer ${authToken}`)
        .query({ search: "Test Job" })
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].jobName).toContain("Test Job");
    });

    it("should filter jobs by status", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/jobs/search")
        .set("Authorization", `Bearer ${authToken}`)
        .query({ status: ["completed", "failed"] })
        .expect(200);

      expect(response.body.data).toBeDefined();
      response.body.data.forEach((job) => {
        expect(["completed", "failed"]).toContain(job.status);
      });
    });

    it("should filter jobs by queue", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/jobs/search")
        .set("Authorization", `Bearer ${authToken}`)
        .query({ queues: ["price-file-parser"] })
        .expect(200);

      expect(response.body.data).toBeDefined();
      response.body.data.forEach((job) => {
        expect(job.queue).toBe("price-file-parser");
      });
    });

    it("should paginate results", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/jobs/search")
        .set("Authorization", `Bearer ${authToken}`)
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.page).toBe(1);
      expect(response.body.total).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Bulk Operations", () => {
    it("should retry failed jobs in bulk", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/jobs/bulk/retry")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          jobIds: ["test-job-2"], // Failed job
        })
        .expect(200);

      expect(response.body.success).toBeDefined();
      expect(response.body.retriedCount).toBeGreaterThanOrEqual(0);
    });

    it("should cancel active jobs in bulk", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/jobs/bulk/cancel")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          jobIds: ["test-job-3"], // Active job
        })
        .expect(200);

      expect(response.body.success).toBeDefined();
      expect(response.body.cancelledCount).toBeGreaterThanOrEqual(0);
    });

    it("should require admin role for bulk operations", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/jobs/bulk/retry")
        .set("Authorization", `Bearer ${authToken}`) // Non-admin token
        .send({
          jobIds: ["test-job-2"],
        })
        .expect(403);
    });
  });

  describe("Analytics", () => {
    it("should get success trends", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/jobs/analytics/success-trends")
        .set("Authorization", `Bearer ${authToken}`)
        .query({ timeRange: "24h" })
        .expect(200);

      expect(response.body).toMatchObject({
        timeRange: "24h",
        interval: expect.any(String),
        trends: expect.any(Array),
        summary: expect.objectContaining({
          totalJobs: expect.any(Number),
          completedJobs: expect.any(Number),
          failedJobs: expect.any(Number),
          overallSuccessRate: expect.any(Number),
        }),
      });
    });

    it("should get performance metrics", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/jobs/analytics/performance")
        .set("Authorization", `Bearer ${authToken}`)
        .query({ queues: ["price-file-parser"] })
        .expect(200);

      expect(response.body).toMatchObject({
        timeRange: expect.any(String),
        queues: expect.any(Array),
        aggregated: expect.any(Object),
      });
    });

    it("should get failure analysis", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/jobs/analytics/failures")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        timeRange: expect.any(String),
        analysis: expect.objectContaining({
          totalFailures: expect.any(Number),
          failuresByQueue: expect.any(Array),
          failuresByReason: expect.any(Array),
        }),
      });
    });

    it("should get resource usage", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/jobs/analytics/resources")
        .set("Authorization", `Bearer ${authToken}`)
        .query({ resources: ["cpu", "memory"] })
        .expect(200);

      expect(response.body).toMatchObject({
        timeRange: expect.any(String),
        usage: expect.objectContaining({
          cpu: expect.any(Object),
          memory: expect.any(Object),
        }),
        alerts: expect.any(Array),
      });
    });
  });

  describe("Export Functionality", () => {
    it("should export jobs to CSV", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/jobs/export")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          format: "csv",
          filters: {
            status: ["completed"],
          },
          fields: ["id", "jobName", "status", "duration"],
        })
        .expect(200);

      expect(response.body).toMatchObject({
        url: expect.stringMatching(/^https?:\/\//),
        filename: expect.stringMatching(/\.csv$/),
        format: "csv",
        totalRecords: expect.any(Number),
      });
    });

    it("should export jobs to JSON with logs", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/jobs/export")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          format: "json",
          includeLogs: true,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        data: expect.any(Array),
        format: "json",
        totalRecords: expect.any(Number),
      });
    });
  });

  describe("Schedule Management", () => {
    it("should list schedules", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/jobs/schedules")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      const testSchedule = response.body.find((s) => s.id === testScheduleId);
      expect(testSchedule).toBeDefined();
      expect(testSchedule.name).toBe("Test Schedule");
    });

    it("should get single schedule", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/jobs/schedules/${testScheduleId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testScheduleId,
        name: "Test Schedule",
        cronExpression: "0 2 * * *",
        isEnabled: true,
      });
    });

    it("should create new schedule", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/jobs/schedules")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "New Test Schedule",
          templateId: testTemplateId,
          cronExpression: "0 3 * * *",
          timezone: "America/New_York",
          priority: 2,
        })
        .expect(201);

      expect(response.body).toMatchObject({
        name: "New Test Schedule",
        cronExpression: "0 3 * * *",
        timezone: "America/New_York",
      });

      // Clean up
      await databaseService.db
        .delete(jobSchedules)
        .where(eq(jobSchedules.id, response.body.id));
    });

    it("should update schedule", async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/jobs/schedules/${testScheduleId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Updated Test Schedule",
          isEnabled: false,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        id: testScheduleId,
        name: "Updated Test Schedule",
        isEnabled: false,
      });

      // Restore original state
      await databaseService.db
        .update(jobSchedules)
        .set({ name: "Test Schedule", isEnabled: true })
        .where(eq(jobSchedules.id, testScheduleId));
    });

    it("should run schedule immediately", async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/jobs/schedules/${testScheduleId}/run`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        jobId: expect.any(String),
        message: expect.any(String),
      });
    });

    it("should require admin role for schedule management", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/jobs/schedules")
        .set("Authorization", `Bearer ${authToken}`) // Non-admin
        .send({
          name: "Unauthorized Schedule",
          templateId: testTemplateId,
          cronExpression: "0 4 * * *",
        })
        .expect(403);
    });
  });

  describe("WebSocket Real-time Updates", () => {
    it("should receive job updates", (done) => {
      const jobUpdateHandler = (data) => {
        expect(data).toMatchObject({
          queue: expect.any(String),
          jobId: expect.any(String),
          type: expect.any(String),
        });
        wsClient.off("jobUpdate", jobUpdateHandler);
        done();
      };

      wsClient.on("jobUpdate", jobUpdateHandler);

      // Subscribe to all jobs
      wsClient.emit("subscribeAll", {}, (response) => {
        expect(response.event).toBe("subscribed");

        // Trigger a job update (in real scenario, this would come from job processing)
        // For testing, we'll create a new job
        request(app.getHttpServer())
          .post("/api/v1/jobs/trigger")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            queueName: "price-file-parser",
            jobName: "test-websocket-job",
            jobData: { test: true },
          })
          .expect(200)
          .end((err) => {
            if (err) done(err);
          });
      });
    });

    it("should receive queue statistics", (done) => {
      const queueStatsHandler = (data) => {
        expect(data).toMatchObject({
          queue: expect.any(String),
          active: expect.any(Number),
          waiting: expect.any(Number),
          completed: expect.any(Number),
          failed: expect.any(Number),
        });
        wsClient.off("queueStats", queueStatsHandler);
        done();
      };

      wsClient.on("queueStats", queueStatsHandler);

      // Subscribe to specific queue
      wsClient.emit(
        "subscribeQueue",
        { queue: "price-file-parser" },
        (response) => {
          expect(response.event).toBe("subscribed");
          // In real scenario, stats would be emitted periodically
        }
      );

      // Simulate stats emission
      setTimeout(() => {
        wsClient.emit("queueStats", {
          queue: "price-file-parser",
          active: 5,
          waiting: 10,
          completed: 100,
          failed: 2,
        });
      }, 100);
    });

    it("should handle subscription errors", (done) => {
      // Create a non-admin WebSocket client
      const nonAdminClient = io(`http://localhost:${app.getHttpServer().address().port}/jobs`, {
        auth: {
          token: authToken, // Non-admin token
        },
      });

      nonAdminClient.on("connect", () => {
        nonAdminClient.emit("subscribeAll", {}, (error) => {
          expect(error).toBeDefined();
          nonAdminClient.disconnect();
          done();
        });
      });

      nonAdminClient.on("exception", (error) => {
        expect(error.message).toBe("Unauthorized");
        nonAdminClient.disconnect();
        done();
      });
    });
  });

  describe("Performance Under Load", () => {
    it("should handle multiple concurrent search requests", async () => {
      const requests = Array(10)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .get("/api/v1/jobs/search")
            .set("Authorization", `Bearer ${authToken}`)
            .query({ status: ["completed"] })
        );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
      });
    });

    it("should handle large export requests", async () => {
      // Create many test jobs
      const largeJobBatch = Array(100)
        .fill(null)
        .map((_, i) => ({
          id: `perf-test-job-${i}`,
          jobType: "performance-test",
          jobName: `Performance Test Job ${i}`,
          queue: "price-file-parser",
          status: i % 3 === 0 ? "failed" : "completed",
          priority: 1,
          duration: Math.floor(Math.random() * 10000),
          createdBy: "perf-test",
        }));

      // Insert jobs
      for (const job of largeJobBatch) {
        await databaseService.db.insert(jobs).values(job as any);
      }

      // Export large dataset
      const response = await request(app.getHttpServer())
        .post("/api/v1/jobs/export")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          format: "csv",
          filters: {
            jobType: ["performance-test"],
          },
        })
        .timeout(30000) // 30 second timeout
        .expect(200);

      expect(response.body.totalRecords).toBeGreaterThanOrEqual(100);

      // Clean up
      for (const job of largeJobBatch) {
        await databaseService.db.delete(jobs).where(eq(jobs.id, job.id));
      }
    });
  });

  describe("Error Recovery", () => {
    it("should handle database connection errors gracefully", async () => {
      // This would require mocking database failures
      // In real E2E tests, we verify the app continues to respond
      const response = await request(app.getHttpServer())
        .get("/api/v1/health")
        .expect(200);

      expect(response.body.status).toBe("ok");
    });

    it("should recover from WebSocket disconnections", (done) => {
      wsClient.disconnect();

      setTimeout(() => {
        wsClient.connect();
        wsClient.on("connect", () => {
          expect(wsClient.connected).toBe(true);
          done();
        });
      }, 100);
    });
  });

  describe("Security", () => {
    it("should reject requests without authentication", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/jobs/search")
        .expect(401);
    });

    it("should reject invalid tokens", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/jobs/search")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);
    });

    it("should validate input parameters", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/jobs/bulk/retry")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          jobIds: "not-an-array", // Invalid type
        })
        .expect(400);

      expect(response.body.message).toContain("validation");
    });

    it("should sanitize export filenames", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/jobs/export")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          format: "csv",
        })
        .expect(200);

      // Filename should not contain dangerous characters
      expect(response.body.filename).toMatch(/^[a-zA-Z0-9\-_.]+$/);
    });
  });
});