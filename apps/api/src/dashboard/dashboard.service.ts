import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { DatabaseService } from "../database/database.service";
import {
  hospitals,
  prices,
  priceTransparencyFiles,
  jobs,
} from "../database/schema";
import { eq, count, sum, desc, and, gte } from "drizzle-orm";

@Injectable()
export class DashboardService {
  constructor(
    @InjectPinoLogger(DashboardService.name)
    private readonly logger: PinoLogger,
    private readonly databaseService: DatabaseService,
  ) {}

  async getDashboardStats() {
    const db = this.databaseService.db;

    try {
      // Get hospital stats
      const [totalHospitals] = await db
        .select({ count: count() })
        .from(hospitals);

      const [activeHospitals] = await db
        .select({ count: count() })
        .from(hospitals)
        .where(eq(hospitals.isActive, true));

      const [hospitalsWithPrices] = await db
        .select({ count: count() })
        .from(hospitals)
        .innerJoin(prices, eq(hospitals.id, prices.hospitalId))
        .groupBy(hospitals.id);

      // Get price stats
      const [totalPrices] = await db.select({ count: count() }).from(prices);

      const [lastPriceUpdate] = await db
        .select({ lastUpdated: prices.lastUpdated })
        .from(prices)
        .orderBy(desc(prices.lastUpdated))
        .limit(1);

      // Get job stats - last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [totalJobs] = await db
        .select({ count: count() })
        .from(jobs)
        .where(gte(jobs.createdAt, twentyFourHoursAgo));

      const [activeJobs] = await db
        .select({ count: count() })
        .from(jobs)
        .where(
          and(
            eq(jobs.status, "active"),
            gte(jobs.createdAt, twentyFourHoursAgo),
          ),
        );

      const [failedJobs] = await db
        .select({ count: count() })
        .from(jobs)
        .where(
          and(
            eq(jobs.status, "failed"),
            gte(jobs.createdAt, twentyFourHoursAgo),
          ),
        );

      const [completedJobs] = await db
        .select({ count: count() })
        .from(jobs)
        .where(
          and(
            eq(jobs.status, "completed"),
            gte(jobs.createdAt, twentyFourHoursAgo),
          ),
        );

      // Calculate success rate
      const totalProcessed =
        (completedJobs?.count || 0) + (failedJobs?.count || 0);
      const successRate =
        totalProcessed > 0
          ? ((completedJobs?.count || 0) / totalProcessed) * 100
          : 0;

      // Get file stats
      const [totalFiles] = await db
        .select({ count: count() })
        .from(priceTransparencyFiles);

      const fileSizeResult = await db
        .select({ totalSize: sum(priceTransparencyFiles.fileSize) })
        .from(priceTransparencyFiles);

      const [pendingFiles] = await db
        .select({ count: count() })
        .from(priceTransparencyFiles)
        .where(eq(priceTransparencyFiles.processingStatus, "pending"));

      return {
        hospitals: {
          total: totalHospitals?.count || 0,
          active: activeHospitals?.count || 0,
          withPrices: hospitalsWithPrices?.count || 0,
        },
        prices: {
          total: totalPrices?.count || 0,
          lastUpdated: lastPriceUpdate?.lastUpdated?.toISOString() || null,
        },
        jobs: {
          totalProcessed: totalJobs?.count || 0,
          activeJobs: activeJobs?.count || 0,
          failedJobs: failedJobs?.count || 0,
          successRate: Math.round(successRate),
        },
        files: {
          totalFiles: totalFiles?.count || 0,
          totalSize: Number(fileSizeResult[0]?.totalSize || 0),
          pendingDownloads: pendingFiles?.count || 0,
        },
      };
    } catch (error) {
      this.logger.error({
        msg: "Failed to get dashboard stats",
        error: error.message,
      });

      // Return default values on error
      return {
        hospitals: { total: 0, active: 0, withPrices: 0 },
        prices: { total: 0, lastUpdated: null },
        jobs: {
          totalProcessed: 0,
          activeJobs: 0,
          failedJobs: 0,
          successRate: 0,
        },
        files: { totalFiles: 0, totalSize: 0, pendingDownloads: 0 },
      };
    }
  }
}
