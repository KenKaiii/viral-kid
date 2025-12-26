import { Worker } from "bullmq";
import { createRedisClient } from "../redis";
import { processJob } from "./processors";
import { setupRecurringJobs } from "./queues";

const QUEUE_NAME = "viral-kid-jobs";

async function startWorker(): Promise<void> {
  console.log("Starting job worker...");

  // Setup recurring jobs
  await setupRecurringJobs();

  // Create the worker
  const worker = new Worker(QUEUE_NAME, processJob, {
    connection: createRedisClient(),
    concurrency: 5,
  });

  // Event handlers
  worker.on("completed", (job) => {
    console.log(`Job ${job.id} (${job.name}) completed successfully`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Job ${job?.id} (${job?.name}) failed:`, error.message);
  });

  worker.on("error", (error) => {
    console.error("Worker error:", error);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down worker...`);
    await worker.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  console.log("Worker is running. Press Ctrl+C to stop.");
}

startWorker().catch((error) => {
  console.error("Failed to start worker:", error);
  process.exit(1);
});
