import { Queue } from "bullmq";
import Redis from "ioredis";
import * as dotenv from "dotenv";
import { QUEUE_NAMES } from "../src/jobs/queues/queue.config";

dotenv.config();

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

async function checkQueueStatus() {
  console.log("📊 Checking queue status...\n");

  try {
    // Check all queues
    const queueNames = Object.values(QUEUE_NAMES);

    for (const queueName of queueNames) {
      const queue = new Queue(queueName, { connection: redis });

      const waitingCount = await queue.getWaitingCount();
      const activeCount = await queue.getActiveCount();
      const completedCount = await queue.getCompletedCount();
      const failedCount = await queue.getFailedCount();
      const delayedCount = await queue.getDelayedCount();
      const pausedCount = 0; // getPausedCount not available in current version

      const total =
        waitingCount +
        activeCount +
        completedCount +
        failedCount +
        delayedCount +
        pausedCount;

      if (total > 0) {
        console.log(`📦 Queue: ${queueName}`);
        console.log(`   Waiting: ${waitingCount}`);
        console.log(`   Active: ${activeCount}`);
        console.log(`   Completed: ${completedCount}`);
        console.log(`   Failed: ${failedCount}`);
        console.log(`   Delayed: ${delayedCount}`);
        console.log(`   Paused: ${pausedCount}`);
        console.log(`   Total: ${total}\n`);
      }
    }

    // Check specific jobs in price-file-parser queue
    const priceQueue = new Queue(QUEUE_NAMES.PRICE_FILE_PARSER, {
      connection: redis,
    });

    console.log("\n🔍 Checking price-file-parser jobs...");

    // Get all job IDs
    const jobCounts = await priceQueue.getJobCounts();
    console.log("Job counts:", jobCounts);

    // Get some waiting jobs
    const waitingJobs = await priceQueue.getWaiting(0, 5);
    if (waitingJobs.length > 0) {
      console.log("\nSample waiting jobs:");
      waitingJobs.forEach((job) => {
        console.log(`  - Job ${job.id}: ${job.name}`);
      });
    }

    // Get some completed jobs
    const completedJobs = await priceQueue.getCompleted(0, 5);
    if (completedJobs.length > 0) {
      console.log("\nSample completed jobs:");
      completedJobs.forEach((job) => {
        console.log(`  - Job ${job.id}: ${job.name}`);
      });
    }

    // Get some failed jobs
    const failedJobs = await priceQueue.getFailed(0, 5);
    if (failedJobs.length > 0) {
      console.log("\nSample failed jobs:");
      failedJobs.forEach((job) => {
        console.log(`  - Job ${job.id}: ${job.name} - ${job.failedReason}`);
      });
    }

    // Check if queue is paused
    const isPaused = await priceQueue.isPaused();
    console.log(`\nQueue paused: ${isPaused}`);

    await redis.quit();
    console.log("\n✅ Queue status check completed");
  } catch (error) {
    console.error("❌ Error checking queue status:", error);
    await redis.quit();
    process.exit(1);
  }
}

// Run the script
checkQueueStatus();
