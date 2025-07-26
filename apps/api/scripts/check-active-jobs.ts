import { Queue } from "bullmq";
import Redis from "ioredis";
import * as dotenv from "dotenv";
import { QUEUE_NAMES } from "../src/jobs/queues/queue.config";

dotenv.config();

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

async function checkActiveJobs() {
  console.log("🔍 Checking active jobs...\n");

  try {
    const priceQueue = new Queue(QUEUE_NAMES.PRICE_FILE_PARSER, {
      connection: redis,
    });

    // Get active jobs
    const activeJobs = await priceQueue.getActive();

    console.log(`Found ${activeJobs.length} active jobs\n`);

    for (const job of activeJobs) {
      console.log(`📄 Job ID: ${job.id}`);
      console.log(`   Name: ${job.name}`);
      console.log(`   Progress: ${job.progress}`);
      console.log(`   Attempts: ${job.attemptsMade}/${job.opts.attempts}`);
      console.log(`   Started: ${new Date(job.processedOn).toISOString()}`);
      console.log(`   Data:`, JSON.stringify(job.data, null, 2));
      console.log("");
    }

    await redis.quit();
    console.log("✅ Active jobs check completed");
  } catch (error) {
    console.error("❌ Error checking active jobs:", error);
    await redis.quit();
    process.exit(1);
  }
}

// Run the script
checkActiveJobs();
