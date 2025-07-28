import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";
import { DatabaseService } from "../../../database/database.service";
import { jobs, jobLogs } from "../../../database/schema";
import { sql, eq, and, gte, lte, desc as _desc, asc, count } from "drizzle-orm";
import { QUEUE_NAMES } from "../../queues/queue.config";
import { JobAnalyticsQueryDto } from "../../dto/job-operations.dto";

interface JobFailure {
  id: string;
  jobName: string;
  queue: string;
  errorMessage: string | null;
  completedAt: Date | null;
  duration: number | null;
}

@Injectable()
export class JobAnalyticsService {
  constructor(
    @InjectQueue(QUEUE_NAMES.PRICE_FILE_PARSER)
    private readonly priceFileParserQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PRICE_UPDATE)
    private readonly priceUpdateQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EXPORT_DATA)
    private readonly exportDataQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ANALYTICS_REFRESH)
    private readonly analyticsRefreshQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PRA_UNIFIED_SCAN)
    private readonly praUnifiedScanQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PRA_FILE_DOWNLOAD)
    private readonly praFileDownloadQueue: Queue,
    @InjectPinoLogger(JobAnalyticsService.name)
    private readonly logger: PinoLogger,
    private readonly databaseService: DatabaseService,
  ) {}

  private getAllQueues() {
    return [
      { name: QUEUE_NAMES.PRICE_FILE_PARSER, queue: this.priceFileParserQueue },
      { name: QUEUE_NAMES.PRICE_UPDATE, queue: this.priceUpdateQueue },
      { name: QUEUE_NAMES.EXPORT_DATA, queue: this.exportDataQueue },
      { name: QUEUE_NAMES.ANALYTICS_REFRESH, queue: this.analyticsRefreshQueue },
      { name: QUEUE_NAMES.PRA_UNIFIED_SCAN, queue: this.praUnifiedScanQueue },
      { name: QUEUE_NAMES.PRA_FILE_DOWNLOAD, queue: this.praFileDownloadQueue },
    ];
  }

  async getSuccessTrends(query: JobAnalyticsQueryDto) {
    const timeRange = this.parseTimeRange(query.timeRange || "24h");
    const groupByInterval = this.getGroupByInterval(query.timeRange || "24h");

    try {
      // Get historical data from database
      const historicalData = await this.getHistoricalSuccessRates(
        timeRange,
        groupByInterval,
        query.queues,
      );

      // Get real-time data from queues
      const realtimeData = await this.getRealtimeSuccessRates(
        timeRange,
        query.queues,
      );

      // Merge and process data
      const trends = this.mergeSuccessTrends(
        historicalData,
        realtimeData,
        groupByInterval,
      );

      return {
        timeRange: query.timeRange || "24h",
        interval: groupByInterval,
        trends,
        summary: this.calculateSummary(trends),
        timestamp: new Date().toISOString(),
      };
    } catch (_error) {
      this.logger.error({
        msg: "Failed to get success trends",
        error: (_error as Error).message,
      });
      throw _error;
    }
  }

  async getPerformanceMetrics(query: JobAnalyticsQueryDto) {
    const timeRange = this.parseTimeRange(query.timeRange || "24h");

    try {
      const metrics = await Promise.all(
        this.getAllQueues()
          .filter(q => !query.queues || query.queues.includes(q.name))
          .map(async ({ name, queue }) => {
            const queueMetrics = await this.getQueuePerformanceMetrics(
              name,
              queue,
              timeRange,
            );
            return { queue: name, ...queueMetrics };
          }),
      );

      const aggregated = this.aggregatePerformanceMetrics(metrics);

      return {
        timeRange: query.timeRange || "24h",
        queues: metrics,
        aggregated,
        timestamp: new Date().toISOString(),
      };
    } catch (_error) {
      this.logger.error({
        msg: "Failed to get performance metrics",
        error: (_error as Error).message,
      });
      throw _error;
    }
  }

  async getFailureAnalysis(query: JobAnalyticsQueryDto) {
    const timeRange = this.parseTimeRange(query.timeRange || "24h");

    try {
      // Get failure data from database
      const dbFailures = await this.getDatabaseFailures(timeRange, query.queues);

      // Get recent failures from queues
      const queueFailures = await this.getQueueFailures(timeRange, query.queues);

      // Analyze failure patterns
      const analysis = {
        totalFailures: dbFailures.length + queueFailures.length,
        failuresByQueue: this.groupFailuresByQueue([...dbFailures, ...queueFailures]),
        failuresByReason: this.groupFailuresByReason([...dbFailures, ...queueFailures]),
        failuresByTime: this.groupFailuresByTime(
          [...dbFailures, ...queueFailures],
          query.timeRange || "24h",
        ),
        topFailingJobs: this.getTopFailingJobs([...dbFailures, ...queueFailures]),
        recommendations: this.generateFailureRecommendations([
          ...dbFailures,
          ...queueFailures,
        ]),
      };

      return {
        timeRange: query.timeRange || "24h",
        analysis,
        timestamp: new Date().toISOString(),
      };
    } catch (_error) {
      this.logger.error({
        msg: "Failed to get failure analysis",
        error: (_error as Error).message,
      });
      throw _error;
    }
  }

  async getResourceUsage(query: { timeRange?: string; resources?: string[] }) {
    const timeRange = this.parseTimeRange(query.timeRange || "1h");

    try {
      const usage = {
        cpu: await this.getCPUUsage(timeRange),
        memory: await this.getMemoryUsage(timeRange),
        redis: await this.getRedisUsage(),
        database: await this.getDatabaseUsage(),
        queues: await this.getQueueResourceUsage(),
      };

      // Filter by requested resources
      const filteredUsage = query.resources
        ? Object.fromEntries(
            Object.entries(usage).filter(([key]) => query.resources.includes(key)),
          )
        : usage;

      return {
        timeRange: query.timeRange || "1h",
        usage: filteredUsage,
        alerts: this.checkResourceAlerts(filteredUsage),
        timestamp: new Date().toISOString(),
      };
    } catch (_error) {
      this.logger.error({
        msg: "Failed to get resource usage",
        error: (_error as Error).message,
      });
      throw _error;
    }
  }

  // Helper methods
  private parseTimeRange(timeRange: string): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();

    const match = timeRange.match(/(\d+)([hd])/);
    if (!match) {
      start.setHours(end.getHours() - 24); // Default to 24h
    } else {
      const [, value, unit] = match;
      const amount = parseInt(value);
      
      if (unit === "h") {
        start.setHours(end.getHours() - amount);
      } else if (unit === "d") {
        start.setDate(end.getDate() - amount);
      }
    }

    return { start, end };
  }

  private getGroupByInterval(timeRange: string): string {
    const match = timeRange.match(/(\d+)([hd])/);
    if (!match) return "hour";

    const [, value, unit] = match;
    const amount = parseInt(value);

    if (unit === "h" && amount <= 6) return "15min";
    if (unit === "h" && amount <= 24) return "hour";
    if (unit === "d" && amount <= 7) return "day";
    return "day";
  }

  private async getHistoricalSuccessRates(
    timeRange: { start: Date; end: Date },
    interval: string,
    queues?: string[],
  ) {
    const db = this.databaseService.db;

    const conditions = [
      gte(jobs.completedAt, timeRange.start),
      lte(jobs.completedAt, timeRange.end),
    ];

    if (queues && queues.length > 0) {
      conditions.push(sql`${jobs.queue} IN ${queues}`);
    }

    const results = await db
      .select({
        queue: jobs.queue,
        status: jobs.status,
        completedAt: jobs.completedAt,
        duration: jobs.duration,
      })
      .from(jobs)
      .where(and(...conditions))
      .orderBy(jobs.completedAt);

    return results;
  }

  private async getRealtimeSuccessRates(
    timeRange: { start: Date; end: Date },
    queues?: string[],
  ) {
    const realtimeData = [];

    for (const { name, queue } of this.getAllQueues()) {
      if (queues && !queues.includes(name)) continue;

      try {
        const [completed, failed] = await Promise.all([
          queue.getCompleted(),
          queue.getFailed(),
        ]);

        const recentJobs = [...completed, ...failed].filter(
          job =>
            job.finishedOn &&
            new Date(job.finishedOn) >= timeRange.start &&
            new Date(job.finishedOn) <= timeRange.end,
        );

        realtimeData.push(
          ...recentJobs.map(job => ({
            queue: name,
            status: job.failedReason ? "failed" : "completed",
            completedAt: new Date(job.finishedOn),
            duration: job.finishedOn - job.processedOn,
          })),
        );
      } catch (_error) {
        this.logger.error({
          msg: "Failed to get realtime data for queue",
          queue: name,
          error: (_error as Error).message,
        });
      }
    }

    return realtimeData;
  }

  private mergeSuccessTrends(
    historical: Array<{
      queue: string;
      status: string;
      completedAt: Date | null;
      duration: number | null;
    }>,
    realtime: Array<{
      queue: string;
      status: string;
      completedAt: Date;
      duration: number;
    }>,
    interval: string,
  ) {
    const combined = [...historical, ...realtime];
    const grouped = new Map();

    combined.forEach(job => {
      const timeKey = this.getTimeKey(job.completedAt, interval);
      if (!grouped.has(timeKey)) {
        grouped.set(timeKey, {
          timestamp: timeKey,
          total: 0,
          completed: 0,
          failed: 0,
          byQueue: {},
        });
      }

      const group = grouped.get(timeKey);
      group.total++;
      
      if (job.status === "completed") {
        group.completed++;
      } else if (job.status === "failed") {
        group.failed++;
      }

      if (!group.byQueue[job.queue]) {
        group.byQueue[job.queue] = { total: 0, completed: 0, failed: 0 };
      }
      
      group.byQueue[job.queue].total++;
      if (job.status === "completed") {
        group.byQueue[job.queue].completed++;
      } else if (job.status === "failed") {
        group.byQueue[job.queue].failed++;
      }
    });

    return Array.from(grouped.values())
      .map(group => ({
        ...group,
        successRate: group.total > 0 ? (group.completed / group.total) * 100 : 0,
        byQueue: Object.entries(group.byQueue).map(([queue, stats]) => {
          const queueStats = stats as { total: number; completed: number; failed: number };
          return {
            queue,
            ...queueStats,
            successRate: queueStats.total > 0 ? (queueStats.completed / queueStats.total) * 100 : 0,
          };
        }),
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  private getTimeKey(date: Date, interval: string): string {
    const d = new Date(date);
    
    switch (interval) {
      case "15min":
        d.setMinutes(Math.floor(d.getMinutes() / 15) * 15, 0, 0);
        break;
      case "hour":
        d.setMinutes(0, 0, 0);
        break;
      case "day":
        d.setHours(0, 0, 0, 0);
        break;
    }

    return d.toISOString();
  }

  private calculateSummary(trends: Array<{
    total: number;
    completed: number;
    failed: number;
    successRate: number;
  }>) {
    const total = trends.reduce((sum, t) => sum + t.total, 0);
    const completed = trends.reduce((sum, t) => sum + t.completed, 0);
    const failed = trends.reduce((sum, t) => sum + t.failed, 0);

    return {
      totalJobs: total,
      completedJobs: completed,
      failedJobs: failed,
      overallSuccessRate: total > 0 ? (completed / total) * 100 : 0,
      trend: this.calculateTrend(trends),
    };
  }

  private calculateTrend(trends: Array<{
    total: number;
    completed: number;
    failed: number;
  }>): "improving" | "stable" | "declining" {
    if (trends.length < 2) return "stable";

    const recentHalf = trends.slice(Math.floor(trends.length / 2));
    const olderHalf = trends.slice(0, Math.floor(trends.length / 2));

    const recentRate = this.averageSuccessRate(recentHalf);
    const olderRate = this.averageSuccessRate(olderHalf);

    const difference = recentRate - olderRate;
    
    if (difference > 5) return "improving";
    if (difference < -5) return "declining";
    return "stable";
  }

  private averageSuccessRate(trends: Array<{
    total: number;
    completed: number;
  }>): number {
    const total = trends.reduce((sum, t) => sum + t.total, 0);
    const completed = trends.reduce((sum, t) => sum + t.completed, 0);
    return total > 0 ? (completed / total) * 100 : 0;
  }

  private async getQueuePerformanceMetrics(
    queueName: string,
    queue: Queue,
    timeRange: { start: Date; end: Date },
  ) {
    try {
      const [completed, failed, active, waiting] = await Promise.all([
        queue.getCompleted(),
        queue.getFailed(),
        queue.getActive(),
        queue.getWaiting(),
      ]);

      const recentJobs = completed
        .filter(
          job =>
            job.finishedOn &&
            new Date(job.finishedOn) >= timeRange.start &&
            new Date(job.finishedOn) <= timeRange.end,
        )
        .slice(0, 1000); // Limit to prevent memory issues

      const processingTimes = recentJobs
        .filter(job => job.processedOn && job.finishedOn)
        .map(job => job.finishedOn - job.processedOn);

      const throughput = recentJobs.length / 
        ((timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60)); // jobs/hour

      return {
        throughput: Math.round(throughput * 100) / 100,
        avgProcessingTime: processingTimes.length > 0
          ? Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length / 1000)
          : 0,
        minProcessingTime: processingTimes.length > 0
          ? Math.round(Math.min(...processingTimes) / 1000)
          : 0,
        maxProcessingTime: processingTimes.length > 0
          ? Math.round(Math.max(...processingTimes) / 1000)
          : 0,
        activeJobs: active.length,
        waitingJobs: waiting.length,
        failureRate: (failed.length / (completed.length + failed.length)) * 100,
      };
    } catch (_error) {
      this.logger.error({
        msg: "Failed to get queue performance metrics",
        queue: queueName,
        error: (_error as Error).message,
      });
      return {
        throughput: 0,
        avgProcessingTime: 0,
        minProcessingTime: 0,
        maxProcessingTime: 0,
        activeJobs: 0,
        waitingJobs: 0,
        failureRate: 0,
      };
    }
  }

  private aggregatePerformanceMetrics(metrics: Array<{
    queue: string;
    throughput: number;
    avgProcessingTime: number;
    minProcessingTime: number;
    maxProcessingTime: number;
    activeJobs: number;
    waitingJobs: number;
    failureRate: number;
  }>) {
    const total = metrics.length;
    if (total === 0) return null;

    return {
      avgThroughput: metrics.reduce((sum, m) => sum + m.throughput, 0) / total,
      totalThroughput: metrics.reduce((sum, m) => sum + m.throughput, 0),
      avgProcessingTime:
        metrics.reduce((sum, m) => sum + m.avgProcessingTime, 0) / total,
      totalActiveJobs: metrics.reduce((sum, m) => sum + m.activeJobs, 0),
      totalWaitingJobs: metrics.reduce((sum, m) => sum + m.waitingJobs, 0),
      avgFailureRate: metrics.reduce((sum, m) => sum + m.failureRate, 0) / total,
    };
  }

  private async getDatabaseFailures(
    timeRange: { start: Date; end: Date },
    queues?: string[],
  ) {
    const db = this.databaseService.db;

    const conditions = [
      eq(jobs.status, "failed"),
      gte(jobs.completedAt, timeRange.start),
      lte(jobs.completedAt, timeRange.end),
    ];

    if (queues && queues.length > 0) {
      conditions.push(sql`${jobs.queue} IN ${queues}`);
    }

    const failures = await db
      .select({
        id: jobs.id,
        jobName: jobs.jobName,
        queue: jobs.queue,
        errorMessage: jobs.errorMessage,
        completedAt: jobs.completedAt,
        duration: jobs.duration,
      })
      .from(jobs)
      .where(and(...conditions));

    return failures;
  }

  private async getQueueFailures(
    timeRange: { start: Date; end: Date },
    queues?: string[],
  ) {
    const failures = [];

    for (const { name, queue } of this.getAllQueues()) {
      if (queues && !queues.includes(name)) continue;

      try {
        const failed = await queue.getFailed();
        const recentFailures = failed
          .filter(
            job =>
              job.finishedOn &&
              new Date(job.finishedOn) >= timeRange.start &&
              new Date(job.finishedOn) <= timeRange.end,
          )
          .slice(0, 100); // Limit to prevent memory issues

        failures.push(
          ...recentFailures.map(job => ({
            id: job.id,
            jobName: job.name,
            queue: name,
            errorMessage: job.failedReason,
            completedAt: new Date(job.finishedOn),
            duration: job.finishedOn - job.processedOn,
          })),
        );
      } catch (_error) {
        this.logger.error({
          msg: "Failed to get queue failures",
          queue: name,
          error: (_error as Error).message,
        });
      }
    }

    return failures;
  }

  private groupFailuresByQueue(failures: JobFailure[]) {
    const grouped = failures.reduce((acc, failure) => {
      if (!acc[failure.queue]) {
        acc[failure.queue] = { count: 0, reasons: {} };
      }
      acc[failure.queue].count++;
      
      const reason = failure.errorMessage || "Unknown error";
      acc[failure.queue].reasons[reason] = (acc[failure.queue].reasons[reason] || 0) + 1;
      
      return acc;
    }, {});

    return Object.entries(grouped).map(([queue, data]) => {
      const queueData = data as { count: number; reasons: Record<string, number> };
      return {
        queue,
        count: queueData.count,
        topReasons: Object.entries(queueData.reasons)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([reason, count]) => ({ reason, count })),
      };
    });
  }

  private groupFailuresByReason(failures: JobFailure[]) {
    const grouped = failures.reduce((acc, failure) => {
      const reason = failure.errorMessage || "Unknown error";
      if (!acc[reason]) {
        acc[reason] = { count: 0, queues: {} };
      }
      acc[reason].count++;
      acc[reason].queues[failure.queue] = (acc[reason].queues[failure.queue] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([reason, data]) => {
        const reasonData = data as { count: number; queues: Record<string, number> };
        return {
          reason,
          count: reasonData.count,
          queues: Object.entries(reasonData.queues).map(([queue, count]) => ({ queue, count })),
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private groupFailuresByTime(failures: JobFailure[], timeRange: string) {
    const interval = this.getGroupByInterval(timeRange);
    const grouped = new Map();

    failures.forEach(failure => {
      const timeKey = this.getTimeKey(failure.completedAt, interval);
      grouped.set(timeKey, (grouped.get(timeKey) || 0) + 1);
    });

    return Array.from(grouped.entries())
      .map(([timestamp, count]) => ({ timestamp, count }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  private getTopFailingJobs(failures: JobFailure[]) {
    const jobFailures = failures.reduce((acc, failure) => {
      const key = `${failure.queue}:${failure.jobName}`;
      if (!acc[key]) {
        acc[key] = { queue: failure.queue, jobName: failure.jobName, count: 0 };
      }
      acc[key].count++;
      return acc;
    }, {});

    type JobFailureCount = { queue: string; jobName: string; count: number };
    return Object.values(jobFailures)
      .sort((a, b) => (b as JobFailureCount).count - (a as JobFailureCount).count)
      .slice(0, 10);
  }

  private generateFailureRecommendations(failures: JobFailure[]) {
    const recommendations = [];

    // Check for timeout errors
    const timeoutFailures = failures.filter(f =>
      f.errorMessage?.toLowerCase().includes("timeout"),
    );
    if (timeoutFailures.length > failures.length * 0.1) {
      recommendations.push({
        type: "timeout",
        severity: "high",
        message: "High number of timeout failures detected",
        suggestion: "Consider increasing job timeout limits or optimizing job processing",
        affectedQueues: [...new Set(timeoutFailures.map(f => f.queue))],
      });
    }

    // Check for memory errors
    const memoryFailures = failures.filter(f =>
      f.errorMessage?.toLowerCase().includes("memory"),
    );
    if (memoryFailures.length > 0) {
      recommendations.push({
        type: "memory",
        severity: "critical",
        message: "Memory-related failures detected",
        suggestion: "Review memory limits and optimize memory usage in job processors",
        affectedQueues: [...new Set(memoryFailures.map(f => f.queue))],
      });
    }

    // Check for repeated failures
    const jobFailureCounts = this.getTopFailingJobs(failures);
    const repeatedFailures = jobFailureCounts.filter((j) => (j as { count: number }).count > 5);
    if (repeatedFailures.length > 0) {
      recommendations.push({
        type: "repeated",
        severity: "medium",
        message: "Some jobs are failing repeatedly",
        suggestion: "Review job logic and input validation for frequently failing jobs",
        affectedJobs: repeatedFailures.slice(0, 5),
      });
    }

    return recommendations;
  }

  private async getCPUUsage(timeRange: { start: Date; end: Date }) {
    // In a real implementation, this would query system metrics
    // For now, return simulated data
    const dataPoints = [];
    const interval = 5 * 60 * 1000; // 5 minutes
    
    for (
      let time = timeRange.start.getTime();
      time <= timeRange.end.getTime();
      time += interval
    ) {
      dataPoints.push({
        timestamp: new Date(time).toISOString(),
        usage: Math.random() * 30 + 20, // 20-50% usage
      });
    }

    return {
      current: dataPoints[dataPoints.length - 1]?.usage || 0,
      average: dataPoints.reduce((sum, p) => sum + p.usage, 0) / dataPoints.length,
      peak: Math.max(...dataPoints.map(p => p.usage)),
      dataPoints,
    };
  }

  private async getMemoryUsage(timeRange: { start: Date; end: Date }) {
    // Simulated memory usage data
    const dataPoints = [];
    const interval = 5 * 60 * 1000; // 5 minutes
    
    for (
      let time = timeRange.start.getTime();
      time <= timeRange.end.getTime();
      time += interval
    ) {
      dataPoints.push({
        timestamp: new Date(time).toISOString(),
        usage: Math.random() * 2048 + 1024, // 1-3GB usage
        percentage: Math.random() * 40 + 30, // 30-70% usage
      });
    }

    return {
      current: dataPoints[dataPoints.length - 1]?.usage || 0,
      currentPercentage: dataPoints[dataPoints.length - 1]?.percentage || 0,
      average: dataPoints.reduce((sum, p) => sum + p.usage, 0) / dataPoints.length,
      peak: Math.max(...dataPoints.map(p => p.usage)),
      dataPoints,
    };
  }

  private async getRedisUsage() {
    // In a real implementation, this would query Redis INFO command
    return {
      memoryUsed: Math.random() * 512 + 128, // 128-640MB
      memoryMax: 1024, // 1GB limit
      connectedClients: Math.floor(Math.random() * 20) + 5,
      totalCommands: Math.floor(Math.random() * 1000000),
      keyCount: Math.floor(Math.random() * 10000),
    };
  }

  private async getDatabaseUsage() {
    try {
      const db = this.databaseService.db;
      
      // Get table sizes and counts
      const [jobCount] = await db
        .select({ count: count() })
        .from(jobs);
      
      const [logCount] = await db
        .select({ count: count() })
        .from(jobLogs);

      return {
        tables: {
          jobs: { count: jobCount.count, estimatedSize: jobCount.count * 2048 }, // 2KB per job estimate
          jobLogs: { count: logCount.count, estimatedSize: logCount.count * 512 }, // 512B per log estimate
        },
        connections: {
          active: Math.floor(Math.random() * 10) + 1,
          idle: Math.floor(Math.random() * 5),
          total: 20, // Pool size
        },
      };
    } catch (_error) {
      this.logger.error({
        msg: "Failed to get database usage",
        error: (_error as Error).message,
      });
      return null;
    }
  }

  private async getQueueResourceUsage() {
    const usage = await Promise.all(
      this.getAllQueues().map(async ({ name, queue }) => {
        try {
          const counts = await queue.getJobCounts();
          const workers = await queue.getWorkers();

          return {
            queue: name,
            jobs: counts.active + counts.waiting + counts.delayed,
            workers: workers.length,
            memory: (counts.active + counts.waiting) * 1024, // 1KB per job estimate
          };
        } catch (_error) {
          return {
            queue: name,
            jobs: 0,
            workers: 0,
            memory: 0,
          };
        }
      }),
    );

    return usage;
  }

  private checkResourceAlerts(usage: Record<string, unknown>) {
    const alerts = [];

    // CPU alerts
    const cpu = usage.cpu as { current?: number } | undefined;
    if (cpu?.current && cpu.current > 80) {
      alerts.push({
        type: "cpu",
        severity: "high",
        message: `CPU usage is high: ${cpu.current.toFixed(1)}%`,
      });
    }

    // Memory alerts
    const memory = usage.memory as { currentPercentage?: number } | undefined;
    if (memory?.currentPercentage && memory.currentPercentage > 85) {
      alerts.push({
        type: "memory",
        severity: "critical",
        message: `Memory usage is critical: ${memory.currentPercentage.toFixed(1)}%`,
      });
    }

    // Redis alerts
    const redis = usage.redis as { memoryUsed?: number; memoryMax?: number } | undefined;
    if (redis?.memoryUsed && redis?.memoryMax && redis.memoryUsed / redis.memoryMax > 0.9) {
      alerts.push({
        type: "redis",
        severity: "high",
        message: "Redis memory usage is approaching limit",
      });
    }

    // Queue alerts
    const queues = usage.queues as Array<{ jobs: number }> | undefined;
    if (queues) {
      const totalJobs = queues.reduce((sum, q) => sum + q.jobs, 0);
      if (totalJobs > 10000) {
        alerts.push({
          type: "queue",
          severity: "medium",
          message: `High number of queued jobs: ${totalJobs}`,
        });
      }
    }

    return alerts;
  }
}
