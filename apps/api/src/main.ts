import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import compression from "compression";
import helmet from "helmet";

async function bootstrap() {
  // Create app with buffer logs to capture early logs
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Use Pino logger globally - this replaces the default NestJS logger
  app.useLogger(app.get(Logger));

  // Global exception filter for better error handling and logging
  app.useGlobalFilters(new GlobalExceptionFilter(app.get(Logger)));

  // Security middleware
  app.use(helmet());
  app.use(compression());

  // CORS configuration
  app.enableCors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://glimmr.com", "https://api.glimmr.com"]
        : true,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix
  const apiPrefix = process.env.API_PREFIX || "";
  if (apiPrefix) {
    app.setGlobalPrefix(apiPrefix);
  }

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle("Glimmr API")
    .setDescription("Hospital pricing data aggregation and analytics platform")
    .setVersion("1.0")
    .addBearerAuth()
    .addApiKey(
      {
        type: "apiKey",
        name: "x-api-key",
        in: "header",
        description: "API key for programmatic access",
      },
      "x-api-key",
    )
    .addTag("API", "Core API information and status")
    .addTag("Authentication", "Authentication and authorization")
    .addTag("User Profile", "User profile and preferences management")
    .addTag("Admin - Users", "User administration and management")
    .addTag("Admin - Roles & Permissions", "Role and permission management")
    .addTag("Admin - Email", "Email management and testing")
    .addTag("Hospitals", "Hospital data management")
    .addTag("Prices", "Pricing data operations")
    .addTag("Analytics", "Analytics, insights, and reporting")
    .addTag("Jobs", "Background job management and monitoring")
    .addTag("Notifications", "User notifications and preferences")
    .addTag("Dashboard", "Dashboard statistics and metrics")
    .addTag("Activity", "User activity tracking and logs")
    .addTag("OData", "OData protocol endpoints")
    .addTag("Health", "System health and monitoring")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(apiPrefix ? `${apiPrefix}/docs` : "docs", app, document, {
    customSiteTitle: "Glimmr API Documentation",
    customfavIcon: "/favicon.ico",
    customCss: ".swagger-ui .topbar { display: none }",
  });

  // Start server
  const port = process.env.API_PORT || 3000;
  await app.listen(port, "0.0.0.0");

  // Use structured logging for startup messages
  const _logger = app.get(Logger);
  const docsPath = apiPrefix ? `${apiPrefix}/docs` : "docs";
  const healthPath = apiPrefix ? `${apiPrefix}/health` : "health";

  _logger.log(
    {
      msg: "🚀 Glimmr API started successfully",
      port,
      environment: process.env.NODE_ENV ?? "development",
      apiPrefix: apiPrefix || "none",
      docsUrl: `http://localhost:${port}/${docsPath}`,
      healthUrl: `http://localhost:${port}/${healthPath}`,
    },
    "Bootstrap",
  );
}

bootstrap().catch((error) => {
  // Use console.error for bootstrap failures since logger may not be available
  console.error("❌ Failed to start Glimmr API:", {
    error: (error as Error).message,
    stack: (error as Error).stack,
    timestamp: new Date().toISOString(),
  });
  throw new Error("Unhandled rejection - shutting down");
});
