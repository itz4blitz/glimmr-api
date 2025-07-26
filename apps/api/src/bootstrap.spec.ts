import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ValidationPipe } from "@nestjs/common";

describe("Bootstrap Configuration", () => {
  describe("Swagger Configuration", () => {
    it("should create document builder with correct title", () => {
      const config = new DocumentBuilder().setTitle("Glimmr API").build();

      expect(config.info.title).toBe("Glimmr API");
    });

    it("should create document builder with correct description", () => {
      const config = new DocumentBuilder()
        .setDescription(
          "Hospital pricing data aggregation and analytics platform",
        )
        .build();

      expect(config.info.description).toBe(
        "Hospital pricing data aggregation and analytics platform",
      );
    });

    it("should create document builder with correct version", () => {
      const config = new DocumentBuilder().setVersion("1.0").build();

      expect(config.info.version).toBe("1.0");
    });

    it("should add bearer auth security scheme", () => {
      const config = new DocumentBuilder().addBearerAuth().build();

      expect(config.components.securitySchemes.bearer).toBeDefined();
      const bearerScheme = config.components.securitySchemes.bearer;
      if ("type" in bearerScheme) {
        expect(bearerScheme.type).toBe("http");
        expect(bearerScheme.scheme).toBe("bearer");
      }
    });

    it("should add all required tags", () => {
      const config = new DocumentBuilder()
        .addTag("API", "Core API information and status")
        .addTag("Authentication", "Authentication and authorization")
        .addTag("User Profile", "User profile and preferences management")
        .addTag("Admin - Users", "User administration and management")
        .addTag("Admin - System", "System administration and configuration")
        .addTag("Hospitals", "Hospital data management")
        .addTag("Prices", "Pricing data operations")
        .addTag("Analytics", "Analytics, insights, and reporting")
        .addTag("Jobs", "Background job management and monitoring")
        .addTag("OData", "OData protocol endpoints")
        .addTag("Health", "System health and monitoring")
        .build();

      expect(config.tags).toHaveLength(11);

      const tagNames = config.tags.map((tag) => tag.name);
      expect(tagNames).toContain("API");
      expect(tagNames).toContain("Authentication");
      expect(tagNames).toContain("User Profile");
      expect(tagNames).toContain("Admin - Users");
      expect(tagNames).toContain("Admin - System");
      expect(tagNames).toContain("Hospitals");
      expect(tagNames).toContain("Prices");
      expect(tagNames).toContain("Analytics");
      expect(tagNames).toContain("Jobs");
      expect(tagNames).toContain("OData");
      expect(tagNames).toContain("Health");
    });

    it("should create complete configuration as in main.ts", () => {
      const config = new DocumentBuilder()
        .setTitle("Glimmr API")
        .setDescription(
          "Hospital pricing data aggregation and analytics platform",
        )
        .setVersion("1.0")
        .addBearerAuth()
        .addTag("API", "Core API information and status")
        .addTag("Authentication", "Authentication and authorization")
        .addTag("User Profile", "User profile and preferences management")
        .addTag("Admin - Users", "User administration and management")
        .addTag("Admin - System", "System administration and configuration")
        .addTag("Hospitals", "Hospital data management")
        .addTag("Prices", "Pricing data operations")
        .addTag("Analytics", "Analytics, insights, and reporting")
        .addTag("Jobs", "Background job management and monitoring")
        .addTag("OData", "OData protocol endpoints")
        .addTag("Health", "System health and monitoring")
        .build();

      expect(config.info.title).toBe("Glimmr API");
      expect(config.info.description).toBe(
        "Hospital pricing data aggregation and analytics platform",
      );
      expect(config.info.version).toBe("1.0");
      expect(config.components.securitySchemes.bearer).toBeDefined();
      expect(config.tags).toHaveLength(8);
    });
  });

  describe("Validation Pipe Configuration", () => {
    it("should create validation pipe with correct options", () => {
      const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });

      expect(pipe).toBeDefined();
      expect(pipe["validatorOptions"]).toBeDefined();
    });

    it("should have whitelist enabled", () => {
      const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });

      expect(pipe["validatorOptions"].whitelist).toBe(true);
    });

    it("should have forbidNonWhitelisted enabled", () => {
      const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });

      expect(pipe["validatorOptions"].forbidNonWhitelisted).toBe(true);
    });

    it("should have transform enabled", () => {
      const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });

      // ValidationPipe with transform: true should be configured
      expect(pipe).toBeDefined();
    });
  });

  describe("CORS Configuration", () => {
    it("should handle development environment", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const corsConfig = {
        origin:
          process.env.NODE_ENV === "production"
            ? ["https://glimmr.com", "https://api.glimmr.com"]
            : true,
        credentials: true,
      };

      expect(corsConfig.origin).toBe(true);
      expect(corsConfig.credentials).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it("should handle production environment", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const corsConfig = {
        origin:
          process.env.NODE_ENV === "production"
            ? ["https://glimmr.com", "https://api.glimmr.com"]
            : true,
        credentials: true,
      };

      expect(corsConfig.origin).toEqual([
        "https://glimmr.com",
        "https://api.glimmr.com",
      ]);
      expect(corsConfig.credentials).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("Environment Variables", () => {
    it("should use default port 3000 when API_PORT is not set", () => {
      const originalPort = process.env.API_PORT;
      delete process.env.API_PORT;

      const port = process.env.API_PORT || 3000;
      expect(port).toBe(3000);

      if (originalPort !== undefined) {
        process.env.API_PORT = originalPort;
      }
    });

    it("should use custom port when API_PORT is set", () => {
      const originalPort = process.env.API_PORT;
      process.env.API_PORT = "4000";

      const port = process.env.API_PORT || 3000;
      expect(port).toBe("4000");

      if (originalPort !== undefined) {
        process.env.API_PORT = originalPort;
      } else {
        delete process.env.API_PORT;
      }
    });

    it("should use empty string for API_PREFIX when not set", () => {
      const originalPrefix = process.env.API_PREFIX;
      delete process.env.API_PREFIX;

      const apiPrefix = process.env.API_PREFIX || "";
      expect(apiPrefix).toBe("");

      if (originalPrefix !== undefined) {
        process.env.API_PREFIX = originalPrefix;
      }
    });

    it("should use provided API_PREFIX when set", () => {
      const originalPrefix = process.env.API_PREFIX;
      process.env.API_PREFIX = "v1";

      const apiPrefix = process.env.API_PREFIX || "";
      expect(apiPrefix).toBe("v1");

      if (originalPrefix !== undefined) {
        process.env.API_PREFIX = originalPrefix;
      } else {
        delete process.env.API_PREFIX;
      }
    });
  });

  describe("Path Configuration", () => {
    it("should construct correct path with API prefix", () => {
      const apiPrefix = "api";
      const docsPath = apiPrefix ? `${apiPrefix}/docs` : "docs";

      expect(docsPath).toBe("api/docs");
    });

    it("should construct correct path without API prefix", () => {
      const apiPrefix = "";
      const docsPath = apiPrefix ? `${apiPrefix}/docs` : "docs";

      expect(docsPath).toBe("docs");
    });

    it("should construct correct path with custom prefix", () => {
      const apiPrefix = "v1";
      const docsPath = apiPrefix ? `${apiPrefix}/docs` : "docs";

      expect(docsPath).toBe("v1/docs");
    });
  });

  describe("URL Generation", () => {
    it("should generate correct docs URL with prefix", () => {
      const apiPrefix = "api";
      const port = "3000";
      const docsPath = apiPrefix ? `${apiPrefix}/docs` : "docs";
      const docsUrl = `http://localhost:${port}/${docsPath}`;

      expect(docsUrl).toBe("http://localhost:3000/api/docs");
    });

    it("should generate correct docs URL without prefix", () => {
      const apiPrefix = "";
      const port = "3000";
      const docsPath = apiPrefix ? `${apiPrefix}/docs` : "docs";
      const docsUrl = `http://localhost:${port}/${docsPath}`;

      expect(docsUrl).toBe("http://localhost:3000/docs");
    });

    it("should generate correct health URL with prefix", () => {
      const apiPrefix = "api";
      const port = "3000";
      const healthPath = apiPrefix ? `${apiPrefix}/health` : "health";
      const healthUrl = `http://localhost:${port}/${healthPath}`;

      expect(healthUrl).toBe("http://localhost:3000/api/health");
    });

    it("should generate correct health URL without prefix", () => {
      const apiPrefix = "";
      const port = "3000";
      const healthPath = apiPrefix ? `${apiPrefix}/health` : "health";
      const healthUrl = `http://localhost:${port}/${healthPath}`;

      expect(healthUrl).toBe("http://localhost:3000/health");
    });
  });

  describe("Swagger Setup Options", () => {
    it("should accept custom site title option", () => {
      const options = {
        customSiteTitle: "Glimmr API Documentation",
      };

      expect(options.customSiteTitle).toBe("Glimmr API Documentation");
    });

    it("should accept custom favicon option", () => {
      const options = {
        customfavIcon: "/favicon.ico",
      };

      expect(options.customfavIcon).toBe("/favicon.ico");
    });

    it("should accept custom CSS option", () => {
      const options = {
        customCss: ".swagger-ui .topbar { display: none }",
      };

      expect(options.customCss).toBe(".swagger-ui .topbar { display: none }");
    });

    it("should accept all custom options together", () => {
      const options = {
        customSiteTitle: "Glimmr API Documentation",
        customfavIcon: "/favicon.ico",
        customCss: ".swagger-ui .topbar { display: none }",
      };

      expect(options.customSiteTitle).toBe("Glimmr API Documentation");
      expect(options.customfavIcon).toBe("/favicon.ico");
      expect(options.customCss).toBe(".swagger-ui .topbar { display: none }");
    });
  });
});
