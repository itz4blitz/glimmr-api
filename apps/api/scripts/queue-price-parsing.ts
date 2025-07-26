import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { priceTransparencyFiles } from "../src/database/schema/price-transparency-files";
import { eq, and, isNotNull, or } from "drizzle-orm";
import * as dotenv from "dotenv";
import { QUEUE_NAMES } from "../src/jobs/queues/queue.config";
import type { PriceFileParseJobData } from "../src/jobs/processors/price-file-parser.processor";

dotenv.config();

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/glimmr_dev",
});

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const db = drizzle(pool);

async function queuePriceParsingJobs() {
  console.log("🚀 Starting to queue price parsing jobs...\n");

  try {
    // Initialize the price file parser queue
    const priceFileParserQueue = new Queue(QUEUE_NAMES.PRICE_FILE_PARSER, {
      connection: redis,
    });

    // Get all downloaded files that haven't been processed yet
    const filesToProcess = await db
      .select()
      .from(priceTransparencyFiles)
      .where(
        and(
          isNotNull(priceTransparencyFiles.storageKey),
          eq(priceTransparencyFiles.isActive, true),
          or(
            eq(priceTransparencyFiles.processingStatus, "downloaded"),
            eq(priceTransparencyFiles.processingStatus, "pending"),
          ),
        ),
      );

    console.log(`Found ${filesToProcess.length} files to queue for parsing\n`);

    if (filesToProcess.length === 0) {
      console.log("No files need processing. Exiting.");
      await cleanup();
      return;
    }

    let queuedCount = 0;
    let skippedCount = 0;
    const errors: Array<{ file: string; error: string }> = [];

    // Queue each file for parsing
    for (const file of filesToProcess) {
      try {
        // Validate required fields
        if (!file.storageKey) {
          errors.push({
            file: file.filename,
            error: "Missing storage key",
          });
          skippedCount++;
          continue;
        }

        if (!file.fileSize) {
          errors.push({
            file: file.filename,
            error: "Missing file size",
          });
          skippedCount++;
          continue;
        }

        // Prepare job data
        const jobData: PriceFileParseJobData = {
          hospitalId: file.hospitalId,
          fileId: file.id,
          storageKey: file.storageKey,
          filename: file.filename,
          fileType: file.fileType,
          fileSize: file.fileSize,
        };

        // Add job to queue with appropriate priority based on file size
        const priority = file.fileSize > 100 * 1024 * 1024 ? 5 : 3; // Lower priority for files > 100MB

        await priceFileParserQueue.add(`parse-${file.id}`, jobData, {
          priority,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: {
            age: 24 * 3600, // Keep completed jobs for 24 hours
            count: 1000, // Keep last 1000 completed jobs
          },
          removeOnFail: {
            age: 7 * 24 * 3600, // Keep failed jobs for 7 days
          },
        });

        queuedCount++;

        if (queuedCount % 10 === 0) {
          console.log(
            `Progress: ${queuedCount}/${filesToProcess.length} files queued`,
          );
        }
      } catch (error) {
        errors.push({
          file: file.filename,
          error: error.message,
        });
        skippedCount++;
      }
    }

    console.log("\n📊 Queue Summary:");
    console.log(`✅ Successfully queued: ${queuedCount} files`);
    console.log(`⏭️  Skipped: ${skippedCount} files`);

    if (errors.length > 0) {
      console.log("\n❌ Errors encountered:");
      errors.slice(0, 10).forEach(({ file, error }) => {
        console.log(`  - ${file}: ${error}`);
      });
      if (errors.length > 10) {
        console.log(`  ... and ${errors.length - 10} more errors`);
      }
    }

    // Get queue status
    const waitingCount = await priceFileParserQueue.getWaitingCount();
    const activeCount = await priceFileParserQueue.getActiveCount();
    const completedCount = await priceFileParserQueue.getCompletedCount();
    const failedCount = await priceFileParserQueue.getFailedCount();

    console.log("\n📈 Queue Status:");
    console.log(`  Waiting: ${waitingCount}`);
    console.log(`  Active: ${activeCount}`);
    console.log(`  Completed: ${completedCount}`);
    console.log(`  Failed: ${failedCount}`);

    await cleanup();
    console.log("\n✨ Price parsing jobs queued successfully!");
  } catch (error) {
    console.error("❌ Error queuing price parsing jobs:", error);
    await cleanup();
    process.exit(1);
  }
}

async function cleanup() {
  await redis.quit();
  await pool.end();
}

// Run the script
queuePriceParsingJobs();
