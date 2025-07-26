import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { GlobalExceptionFilter } from "../src/common/exceptions";

describe("Swagger Error Documentation (e2e)", () => {
  let app: INestApplication;
  let swaggerDocument: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same configuration as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    app.useGlobalFilters(new GlobalExceptionFilter());

    // Create Swagger document (same as main.ts)
    const config = new DocumentBuilder()
      .setTitle("Glimmr API")
      .setDescription(
        "Hospital pricing data aggregation and analytics platform",
      )
      .setVersion("1.0")
      .addBearerAuth()
      .addTag("api", "Core API information and status")
      .addTag("auth", "Authentication and authorization")
      .addTag("hospitals", "Hospital data management")
      .addTag("prices", "Pricing data operations")
      .addTag("analytics", "Analytics, insights, and reporting")
      .addTag("jobs", "Background job management and monitoring")
      .addTag("odata", "OData protocol endpoints")
      .addTag("health", "System health and monitoring")
      .build();

    swaggerDocument = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("docs", app, swaggerDocument);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Swagger Document Structure", () => {
    it("should generate valid OpenAPI document", () => {
      expect(swaggerDocument).toBeDefined();
      expect(swaggerDocument.openapi).toBe("3.0.0");
      expect(swaggerDocument.info).toBeDefined();
      expect(swaggerDocument.paths).toBeDefined();
      expect(swaggerDocument.components).toBeDefined();
    });

    it("should include ErrorResponseDto in components", () => {
      expect(swaggerDocument.components.schemas).toBeDefined();
      expect(swaggerDocument.components.schemas.ErrorResponseDto).toBeDefined();

      const errorResponseSchema =
        swaggerDocument.components.schemas.ErrorResponseDto;
      expect(errorResponseSchema.type).toBe("object");
      expect(errorResponseSchema.properties).toBeDefined();
    });

    it("should have proper ErrorResponseDto schema properties", () => {
      const errorResponseSchema =
        swaggerDocument.components.schemas.ErrorResponseDto;
      const properties = errorResponseSchema.properties;

      // Required properties
      expect(properties.statusCode).toBeDefined();
      expect(properties.message).toBeDefined();
      expect(properties.error).toBeDefined();
      expect(properties.timestamp).toBeDefined();
      expect(properties.path).toBeDefined();

      // Optional properties
      expect(properties.details).toBeDefined();
      expect(properties.traceId).toBeDefined();

      // Verify property types
      expect(properties.statusCode.type).toBe("number");
      expect(properties.message.type).toBe("string");
      expect(properties.error.type).toBe("string");
      expect(properties.timestamp.type).toBe("string");
      expect(properties.path.type).toBe("string");
    });

    it("should have proper property descriptions", () => {
      const errorResponseSchema =
        swaggerDocument.components.schemas.ErrorResponseDto;
      const properties = errorResponseSchema.properties;

      expect(properties.statusCode.description).toBeDefined();
      expect(properties.message.description).toBeDefined();
      expect(properties.error.description).toBeDefined();
      expect(properties.timestamp.description).toBeDefined();
      expect(properties.path.description).toBeDefined();
      expect(properties.details.description).toBeDefined();
      expect(properties.traceId.description).toBeDefined();
    });

    it("should have proper property examples", () => {
      const errorResponseSchema =
        swaggerDocument.components.schemas.ErrorResponseDto;
      const properties = errorResponseSchema.properties;

      expect(properties.statusCode.example).toBe(400);
      expect(properties.message.example).toBe("Invalid request parameters");
      expect(properties.error.example).toBe("INVALID_REQUEST");
      expect(properties.timestamp.example).toBe("2025-07-18T20:41:36.480Z");
      expect(properties.path.example).toBe("/api/v1/hospitals/123");
    });
  });

  describe("Hospital Endpoints Error Documentation", () => {
    it("should document error responses for GET /hospitals", () => {
      const hospitalsPath = swaggerDocument.paths["/hospitals"];
      expect(hospitalsPath).toBeDefined();

      const getOperation = hospitalsPath.get;
      expect(getOperation).toBeDefined();
      expect(getOperation.responses).toBeDefined();

      // Should have 500 error response
      expect(getOperation.responses["500"]).toBeDefined();
      expect(getOperation.responses["500"].description).toBe(
        "Internal server error",
      );
      expect(getOperation.responses["500"].content).toBeDefined();
      expect(
        getOperation.responses["500"].content["application/json"],
      ).toBeDefined();
      expect(
        getOperation.responses["500"].content["application/json"].schema,
      ).toBeDefined();
      expect(
        getOperation.responses["500"].content["application/json"].schema.$ref,
      ).toBe("#/components/schemas/ErrorResponseDto");
    });

    it("should document error responses for GET /hospitals/{id}", () => {
      const hospitalByIdPath = swaggerDocument.paths["/hospitals/{id}"];
      expect(hospitalByIdPath).toBeDefined();

      const getOperation = hospitalByIdPath.get;
      expect(getOperation).toBeDefined();
      expect(getOperation.responses).toBeDefined();

      // Should have 404 error response
      expect(getOperation.responses["404"]).toBeDefined();
      expect(getOperation.responses["404"].description).toBe(
        "Hospital not found",
      );
      expect(
        getOperation.responses["404"].content["application/json"].schema.$ref,
      ).toBe("#/components/schemas/ErrorResponseDto");

      // Should have 500 error response
      expect(getOperation.responses["500"]).toBeDefined();
      expect(getOperation.responses["500"].description).toBe(
        "Internal server error",
      );
      expect(
        getOperation.responses["500"].content["application/json"].schema.$ref,
      ).toBe("#/components/schemas/ErrorResponseDto");
    });

    it("should document error responses for GET /hospitals/{id}/prices", () => {
      const hospitalPricesPath =
        swaggerDocument.paths["/hospitals/{id}/prices"];
      expect(hospitalPricesPath).toBeDefined();

      const getOperation = hospitalPricesPath.get;
      expect(getOperation).toBeDefined();
      expect(getOperation.responses).toBeDefined();

      // Should have 404 error response
      expect(getOperation.responses["404"]).toBeDefined();
      expect(getOperation.responses["404"].description).toBe(
        "Hospital not found",
      );
      expect(
        getOperation.responses["404"].content["application/json"].schema.$ref,
      ).toBe("#/components/schemas/ErrorResponseDto");

      // Should have 500 error response
      expect(getOperation.responses["500"]).toBeDefined();
      expect(getOperation.responses["500"].description).toBe(
        "Internal server error",
      );
      expect(
        getOperation.responses["500"].content["application/json"].schema.$ref,
      ).toBe("#/components/schemas/ErrorResponseDto");
    });
  });

  describe("Swagger UI Accessibility", () => {
    it("should serve Swagger UI at /docs endpoint", async () => {
      const response = await request(app.getHttpServer())
        .get("/docs")
        .expect(200);

      expect(response.text).toContain("swagger-ui");
      expect(response.text).toContain("Glimmr API");
    });

    it("should serve OpenAPI JSON document", async () => {
      const response = await request(app.getHttpServer())
        .get("/docs-json")
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.openapi).toBe("3.0.0");
      expect(response.body.info.title).toBe("Glimmr API");
    });

    it("should include error response examples in Swagger UI", async () => {
      const response = await request(app.getHttpServer())
        .get("/docs-json")
        .expect(200);

      const errorResponseSchema =
        response.body.components.schemas.ErrorResponseDto;
      expect(errorResponseSchema).toBeDefined();

      // Verify that the schema includes proper examples
      const properties = errorResponseSchema.properties;
      expect(properties.statusCode.example).toBeDefined();
      expect(properties.message.example).toBeDefined();
      expect(properties.error.example).toBeDefined();
    });
  });

  describe("Error Response Schema Validation", () => {
    it("should validate ErrorResponseDto schema structure", () => {
      const errorResponseSchema =
        swaggerDocument.components.schemas.ErrorResponseDto;

      // Required fields should be defined
      const requiredFields = [
        "statusCode",
        "message",
        "error",
        "timestamp",
        "path",
      ];
      requiredFields.forEach((field) => {
        expect(errorResponseSchema.properties[field]).toBeDefined();
      });

      // Optional fields should be defined but not required
      const optionalFields = ["details", "traceId"];
      optionalFields.forEach((field) => {
        expect(errorResponseSchema.properties[field]).toBeDefined();
      });

      // Check required array (might not be present in all OpenAPI versions)
      if (errorResponseSchema.required) {
        requiredFields.forEach((field) => {
          expect(errorResponseSchema.required).toContain(field);
        });

        optionalFields.forEach((field) => {
          expect(errorResponseSchema.required).not.toContain(field);
        });
      }
    });

    it("should have consistent error response references across endpoints", () => {
      const paths = swaggerDocument.paths;
      const errorResponseRefs = [];

      // Collect all error response references
      Object.keys(paths).forEach((pathKey) => {
        const path = paths[pathKey];
        Object.keys(path).forEach((method) => {
          const operation = path[method];
          if (operation.responses) {
            Object.keys(operation.responses).forEach((statusCode) => {
              if (statusCode.startsWith("4") || statusCode.startsWith("5")) {
                const response = operation.responses[statusCode];
                if (response.content && response.content["application/json"]) {
                  const schema = response.content["application/json"].schema;
                  if (schema.$ref) {
                    errorResponseRefs.push(schema.$ref);
                  }
                }
              }
            });
          }
        });
      });

      // All error responses should reference the same schema
      const uniqueRefs = [...new Set(errorResponseRefs)];
      expect(uniqueRefs).toHaveLength(1);
      expect(uniqueRefs[0]).toBe("#/components/schemas/ErrorResponseDto");
    });
  });

  describe("HTTP Status Code Coverage", () => {
    it("should document common HTTP error status codes", () => {
      const paths = swaggerDocument.paths;
      const documentedStatusCodes = new Set();

      // Collect all documented status codes
      Object.keys(paths).forEach((pathKey) => {
        const path = paths[pathKey];
        Object.keys(path).forEach((method) => {
          const operation = path[method];
          if (operation.responses) {
            Object.keys(operation.responses).forEach((statusCode) => {
              if (statusCode.startsWith("4") || statusCode.startsWith("5")) {
                documentedStatusCodes.add(statusCode);
              }
            });
          }
        });
      });

      // Should document key error status codes
      const expectedStatusCodes = ["404", "500"];
      expectedStatusCodes.forEach((code) => {
        expect(documentedStatusCodes).toContain(code);
      });
    });

    it("should have meaningful descriptions for error responses", () => {
      const paths = swaggerDocument.paths;

      Object.keys(paths).forEach((pathKey) => {
        const path = paths[pathKey];
        Object.keys(path).forEach((method) => {
          const operation = path[method];
          if (operation.responses) {
            Object.keys(operation.responses).forEach((statusCode) => {
              if (statusCode.startsWith("4") || statusCode.startsWith("5")) {
                const response = operation.responses[statusCode];
                expect(response.description).toBeDefined();
                expect(response.description.length).toBeGreaterThan(0);
                expect(response.description).not.toBe("Error");
              }
            });
          }
        });
      });
    });
  });

  describe("API Documentation Quality", () => {
    it("should have proper API metadata", () => {
      expect(swaggerDocument.info.title).toBe("Glimmr API");
      expect(swaggerDocument.info.description).toContain(
        "Hospital pricing data",
      );
      expect(swaggerDocument.info.version).toBe("1.0");
    });

    it("should have proper endpoint tags", () => {
      const paths = swaggerDocument.paths;

      // Hospital endpoints should be tagged
      expect(paths["/hospitals"].get.tags).toContain("hospitals");
      expect(paths["/hospitals/{id}"].get.tags).toContain("hospitals");
      expect(paths["/hospitals/{id}/prices"].get.tags).toContain("hospitals");
    });

    it("should have operation summaries for error context", () => {
      const paths = swaggerDocument.paths;

      Object.keys(paths).forEach((pathKey) => {
        const path = paths[pathKey];
        Object.keys(path).forEach((method) => {
          const operation = path[method];
          expect(operation.summary).toBeDefined();
          expect(operation.summary.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe("Example Error Responses", () => {
    it("should provide realistic error examples", () => {
      const errorResponseSchema =
        swaggerDocument.components.schemas.ErrorResponseDto;
      const properties = errorResponseSchema.properties;

      // Validate example values are realistic
      expect(typeof properties.statusCode.example).toBe("number");
      expect(properties.statusCode.example).toBeGreaterThanOrEqual(400);
      expect(properties.statusCode.example).toBeLessThan(600);

      expect(typeof properties.message.example).toBe("string");
      expect(properties.message.example.length).toBeGreaterThan(0);

      expect(typeof properties.error.example).toBe("string");
      expect(properties.error.example).toMatch(/^[A-Z_]+$/);

      expect(typeof properties.timestamp.example).toBe("string");
      expect(properties.timestamp.example).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );

      expect(typeof properties.path.example).toBe("string");
      expect(properties.path.example).toMatch(/^\/api\/v1\//);
    });
  });
});
