import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AuthService } from "../src/auth/auth.service";
import { UsersService } from "../src/users/users.service";

describe("Security Edge Cases (e2e)", () => {
  let app: INestApplication;
  let authService: AuthService;
  let usersService: UsersService;

  let validAdminToken: string;
  let validUserToken: string;
  let validApiKey: string;
  let adminUserId: string;
  let apiUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: [".env.test", ".env"],
        }),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    authService = moduleFixture.get<AuthService>(AuthService);
    usersService = moduleFixture.get<UsersService>(UsersService);

    await app.init();

    // Clean up any existing test users
    try {
      const existingAdmin = await usersService.findByUsername("security_admin");
      if (existingAdmin) await usersService.delete(existingAdmin.id);

      const existingUser = await usersService.findByUsername("security_user");
      if (existingUser) await usersService.delete(existingUser.id);
    } catch (error) {
      // Users might not exist, that's fine
    }

    // Create test users
    const adminResult = await authService.register(
      "security_admin",
      "admin123",
      "admin",
    );
    validAdminToken = adminResult.access_token;
    adminUserId = adminResult.user.id;

    const userResult = await authService.register(
      "security_user",
      "user123",
      "api-user",
    );
    validUserToken = userResult.access_token;
    apiUserId = userResult.user.id;

    validApiKey = await authService.generateApiKey(apiUserId);
  });

  afterAll(async () => {
    try {
      if (adminUserId) await usersService.delete(adminUserId);
      if (apiUserId) await usersService.delete(apiUserId);
    } catch (error) {
      // Ignore cleanup errors
    }

    await app.close();
  });

  describe("JWT Token Security", () => {
    it("should reject malformed JWT tokens", async () => {
      const malformedTokens = [
        "malformed.token",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", // Header only
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ", // Header + payload only
        "not.a.jwt.token.at.all",
        "Bearer token", // Wrong format
        "JWT " + validAdminToken.substring(7), // Wrong prefix
      ];

      for (const token of malformedTokens) {
        await request(app.getHttpServer())
          .get("/jobs")
          .set("Authorization", `Bearer ${token}`)
          .expect(401);
      }
    });

    it("should reject JWT tokens with invalid signatures", async () => {
      // Take a valid token and modify the signature
      const tokenParts = validAdminToken.split(".");
      const invalidSignature = tokenParts[2].split("").reverse().join(""); // Reverse signature
      const invalidToken = `${tokenParts[0]}.${tokenParts[1]}.${invalidSignature}`;

      await request(app.getHttpServer())
        .get("/jobs")
        .set("Authorization", `Bearer ${invalidToken}`)
        .expect(401);
    });

    it("should reject authorization headers without Bearer prefix", async () => {
      const invalidFormats = [
        validAdminToken, // No prefix
        `Token ${validAdminToken}`, // Wrong prefix
        `Basic ${validAdminToken}`, // Wrong prefix
        `bearer ${validAdminToken}`, // Lowercase
        `Bearer${validAdminToken}`, // No space
        `Bearer  ${validAdminToken}`, // Double space
      ];

      for (const header of invalidFormats) {
        await request(app.getHttpServer())
          .get("/jobs")
          .set("Authorization", header)
          .expect(401);
      }
    });

    it("should reject empty authorization headers", async () => {
      const emptyHeaders = ["", " ", "Bearer", "Bearer ", "Bearer  "];

      for (const header of emptyHeaders) {
        await request(app.getHttpServer())
          .get("/jobs")
          .set("Authorization", header)
          .expect(401);
      }
    });

    it("should handle very long JWT tokens", async () => {
      const veryLongToken = "a".repeat(10000);

      await request(app.getHttpServer())
        .get("/jobs")
        .set("Authorization", `Bearer ${veryLongToken}`)
        .expect(401);
    });

    it("should reject tokens with null bytes", async () => {
      const tokenWithNullByte = validAdminToken + "\0";

      await request(app.getHttpServer())
        .get("/jobs")
        .set("Authorization", `Bearer ${tokenWithNullByte}`)
        .expect(401);
    });
  });

  describe("API Key Security", () => {
    it("should reject API keys with incorrect format", async () => {
      const invalidApiKeys = [
        "invalid_key",
        "api_key123",
        "wrong_prefix_123",
        "GAPI_123", // Wrong case
        "gapi_", // No key part
        "gapi_" + "a".repeat(1000), // Too long
        "gapi_123\0", // Null byte
        "gapi_123\n", // Newline
        "gapi_123 ", // Trailing space
        " gapi_123", // Leading space
      ];

      for (const apiKey of invalidApiKeys) {
        await request(app.getHttpServer())
          .get("/odata")
          .set("x-api-key", apiKey)
          .expect(401);
      }
    });

    it("should handle case-sensitive header names", async () => {
      const headerVariations = [
        "X-API-KEY",
        "X-Api-Key",
        "x-API-key",
        "X-API-Key",
        "api-key",
        "API-KEY",
      ];

      for (const header of headerVariations) {
        if (header !== "x-api-key") {
          await request(app.getHttpServer())
            .get("/odata")
            .set(header, validApiKey)
            .expect(401);
        }
      }
    });

    it("should reject empty API keys", async () => {
      const emptyKeys = ["", " ", "  ", "\t", "\n"];

      for (const key of emptyKeys) {
        await request(app.getHttpServer())
          .get("/odata")
          .set("x-api-key", key)
          .expect(401);
      }
    });

    it("should reject API keys with special characters", async () => {
      const keysWithSpecialChars = [
        "gapi_123!@#",
        "gapi_123<script>",
        'gapi_123"',
        "gapi_123'",
        "gapi_123;",
        "gapi_123&",
        "gapi_123|",
      ];

      for (const key of keysWithSpecialChars) {
        await request(app.getHttpServer())
          .get("/odata")
          .set("x-api-key", key)
          .expect(401);
      }
    });
  });

  describe("Request Injection Attacks", () => {
    it("should prevent SQL injection in login", async () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "admin' --",
        "' UNION SELECT * FROM users --",
        "'; INSERT INTO users VALUES ('hacker', 'pass'); --",
      ];

      for (const injection of sqlInjectionAttempts) {
        await request(app.getHttpServer())
          .post("/auth/login")
          .send({
            username: injection,
            password: "password",
          })
          .expect(401);
      }
    });

    it("should prevent NoSQL injection in login", async () => {
      const nosqlInjectionAttempts = [
        { $ne: null },
        { $gt: "" },
        { $regex: ".*" },
        { $where: "this.username === this.password" },
      ];

      for (const injection of nosqlInjectionAttempts) {
        await request(app.getHttpServer())
          .post("/auth/login")
          .send({
            username: injection,
            password: "password",
          })
          .expect(400); // Should fail validation
      }
    });

    it("should prevent XSS in registration", async () => {
      const xssAttempts = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        '"><script>alert("xss")</script>',
        "'; alert('xss'); //",
      ];

      for (const xss of xssAttempts) {
        await request(app.getHttpServer())
          .post("/auth/register")
          .send({
            username: xss,
            password: "password123",
            role: "api-user",
          })
          .expect((res) => {
            // Should either reject or sanitize
            expect(res.status).toBeOneOf([400, 401]);
          });
      }
    });

    it("should prevent header injection", async () => {
      const headerInjectionAttempts = [
        "value\r\nInjected-Header: malicious",
        "value\nInjected-Header: malicious",
        "value\r\n\r\nHTTP/1.1 200 OK",
        "value%0d%0aInjected-Header: malicious",
      ];

      for (const injection of headerInjectionAttempts) {
        await request(app.getHttpServer())
          .get("/jobs")
          .set("Authorization", `Bearer ${injection}`)
          .expect(401);
      }
    });
  });

  describe("Rate Limiting and DoS Protection", () => {
    it("should handle rapid sequential requests", async () => {
      const requests = Array(20)
        .fill(null)
        .map(() => request(app.getHttpServer()).get("/health"));

      const responses = await Promise.all(requests);

      // All requests should succeed (health endpoint is public)
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });

    it("should handle large request bodies", async () => {
      const largeBody = {
        username: "a".repeat(10000),
        password: "b".repeat(10000),
        role: "api-user",
      };

      await request(app.getHttpServer())
        .post("/auth/register")
        .send(largeBody)
        .expect((res) => {
          // Should reject due to validation or size limits
          expect(res.status).toBeOneOf([400, 413, 422]);
        });
    });

    it("should handle requests with many headers", async () => {
      let req = request(app.getHttpServer()).get("/health");

      // Add many headers
      for (let i = 0; i < 100; i++) {
        req = req.set(`X-Custom-Header-${i}`, `value-${i}`);
      }

      await req.expect((res) => {
        // Should either succeed or fail gracefully
        expect(res.status).toBeLessThan(500);
      });
    });
  });

  describe("Authentication Bypass Attempts", () => {
    it("should prevent role escalation via JWT manipulation", async () => {
      // Try to manually craft a JWT with admin role
      const fakeJwt =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlIiwidXNlcm5hbWUiOiJmYWtlIiwicm9sZSI6ImFkbWluIn0.fakesignature";

      await request(app.getHttpServer())
        .post("/jobs/hospital-import")
        .set("Authorization", `Bearer ${fakeJwt}`)
        .send({ source: "manual" })
        .expect(401);
    });

    it("should prevent authentication bypass with multiple auth methods", async () => {
      // Try various combinations that might confuse the system
      await request(app.getHttpServer())
        .get("/jobs")
        .set("Authorization", "Bearer invalid.token")
        .set("x-api-key", "invalid_key")
        .expect(401);

      await request(app.getHttpServer())
        .get("/odata")
        .set("Authorization", `Bearer ${validAdminToken}`)
        .set("x-api-key", "invalid_key")
        .expect(401); // OData requires API key, not JWT
    });

    it("should prevent session fixation attacks", async () => {
      // Each login should generate a new token
      const login1 = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          username: "security_admin",
          password: "admin123",
        });

      const login2 = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          username: "security_admin",
          password: "admin123",
        });

      expect(login1.body.access_token).not.toBe(login2.body.access_token);
    });

    it("should prevent privilege escalation via parameter pollution", async () => {
      // Try to send multiple role parameters
      await request(app.getHttpServer())
        .post("/auth/register")
        .send("username=testuser&password=pass123&role=api-user&role=admin")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .expect((res) => {
          expect(res.status).toBeOneOf([400, 422]);
        });
    });
  });

  describe("Information Disclosure Prevention", () => {
    it("should not expose sensitive information in error messages", async () => {
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          username: "security_admin",
          password: "wrongpassword",
        })
        .expect(401)
        .expect((res) => {
          // Should not reveal if user exists or not
          expect(res.body.message).not.toContain("password");
          expect(res.body.message).not.toContain("hash");
          expect(res.body.message).not.toContain("bcrypt");
        });
    });

    it("should not expose database errors", async () => {
      // Try to trigger a database error with invalid data
      await request(app.getHttpServer())
        .post("/auth/register")
        .send({
          username: null,
          password: null,
          role: null,
        })
        .expect((res) => {
          expect(res.status).toBe(400);
          expect(res.body.message).not.toContain("database");
          expect(res.body.message).not.toContain("SQL");
          expect(res.body.message).not.toContain("constraint");
        });
    });

    it("should not expose internal paths in errors", async () => {
      await request(app.getHttpServer())
        .get("/nonexistent-endpoint")
        .expect(404)
        .expect((res) => {
          expect(res.body.message).not.toContain("/Users/");
          expect(res.body.message).not.toContain("src/");
          expect(res.body.message).not.toContain(".ts");
        });
    });
  });

  describe("Bull Board Admin Security", () => {
    it("should deny access without authentication", async () => {
      await request(app.getHttpServer()).get("/admin/queues").expect(401);
    });

    it("should deny access to non-admin users", async () => {
      await request(app.getHttpServer())
        .get("/admin/queues")
        .set("Authorization", `Bearer ${validUserToken}`)
        .expect(401);
    });

    it("should deny access with API key only", async () => {
      await request(app.getHttpServer())
        .get("/admin/queues")
        .set("x-api-key", validApiKey)
        .expect(401);
    });

    it("should handle Bull Board specific paths", async () => {
      const bullBoardPaths = [
        "/admin/queues/",
        "/admin/queues/api/queues",
        "/admin/queues/static/css/main.css",
      ];

      for (const path of bullBoardPaths) {
        await request(app.getHttpServer()).get(path).expect(401);
      }
    });
  });

  describe("Concurrent Attack Simulation", () => {
    it("should handle concurrent invalid login attempts", async () => {
      const concurrentLogins = Array(10)
        .fill(null)
        .map(() =>
          request(app.getHttpServer()).post("/auth/login").send({
            username: "security_admin",
            password: "wrongpassword",
          }),
        );

      const responses = await Promise.all(concurrentLogins);

      responses.forEach((response) => {
        expect(response.status).toBe(401);
      });
    });

    it("should handle concurrent unauthorized access attempts", async () => {
      const concurrentRequests = Array(10)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .post("/jobs/hospital-import")
            .set("Authorization", "Bearer invalid.token")
            .send({ source: "manual" }),
        );

      const responses = await Promise.all(concurrentRequests);

      responses.forEach((response) => {
        expect(response.status).toBe(401);
      });
    });

    it("should maintain security under load", async () => {
      // Mix of valid and invalid requests
      const requests = [
        ...Array(5)
          .fill(null)
          .map(() =>
            request(app.getHttpServer())
              .get("/jobs")
              .set("Authorization", `Bearer ${validAdminToken}`),
          ),
        ...Array(5)
          .fill(null)
          .map(() =>
            request(app.getHttpServer())
              .get("/jobs")
              .set("Authorization", "Bearer invalid.token"),
          ),
      ];

      const responses = await Promise.all(requests);

      // First 5 should succeed, last 5 should fail
      responses.slice(0, 5).forEach((response) => {
        expect(response.status).not.toBe(401);
      });

      responses.slice(5).forEach((response) => {
        expect(response.status).toBe(401);
      });
    });
  });
});

// Custom Jest matcher
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected}`,
        pass: false,
      };
    }
  },
});
