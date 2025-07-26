import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getApiInfo() {
    return {
      name: "Glimmr API",
      version: "1.0.0",
      description: "Hospital pricing data aggregation and analytics platform",
      status: "operational",
      timestamp: new Date().toISOString(),
      endpoints: {
        health: "/api/v1/health",
        docs: "/api/v1/docs",
      },
    };
  }
}
