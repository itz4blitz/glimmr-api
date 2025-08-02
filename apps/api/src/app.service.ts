import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getApiInfo() {
    // Get API prefix from environment (same as main.ts)
    const apiPrefix = process.env.API_PREFIX || "";
    const baseUrl = apiPrefix ? `/${apiPrefix}` : "";

    return {
      name: "Glimmr API",
      version: "1.0.0",
      description: "Hospital pricing data aggregation and analytics platform",
      status: "operational",
      timestamp: new Date().toISOString(),
      endpoints: {
        health: `${baseUrl}/health`,
        docs: `${baseUrl}/docs`,
      },
    };
  }
}
