import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  FileText,
  Settings,
  Calendar,
  Clock,
  AlertCircle,
  XCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QueueStats {
  name: string;
  displayName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  paused?: boolean;
  error?: string;
  processingRate?: number;
  avgProcessingTime?: number;
  lastProcessed?: string;
  config?: {
    schedules?: number;
    activeSchedules?: number;
    nextScheduledRun?: {
      name: string;
      nextRunAt: string;
      cronExpression: string;
    } | null;
  };
}

interface QueueCardProps {
  queue: QueueStats;
  index: number;
  onViewLogs: (queueName: string, displayName: string) => void;
  onPause: (queueName: string) => void;
  onResume: (queueName: string) => void;
  onRetryFailed: (queueName: string) => void;
  onDrain: (queueName: string) => void;
  onConfigure: (queueName: string) => void;
  onTriggerJob?: (queueName: string) => void;
}

function getQueueStatusColor(queue: QueueStats) {
  // Primary status takes precedence
  if (queue.error) return "destructive";
  if (queue.paused) return "secondary";

  // Active processing status
  if (queue.active > 0) {
    // Check health while processing
    const failureRate =
      queue.completed > 0 ? queue.failed / (queue.completed + queue.failed) : 0;
    if (failureRate > 0.5) return "destructive"; // Over 50% failure rate
    if (failureRate > 0.2) return "outline"; // Over 20% failure rate
    return "default"; // Healthy processing
  }

  // Idle/waiting status - check overall health
  if (queue.waiting > 0) {
    if (queue.failed > 10) return "outline"; // Has work but concerning failures
    return "default"; // Has work waiting
  }

  // Truly idle
  if (queue.failed > 10) return "outline"; // Idle with concerning failures
  return "secondary"; // Idle and healthy
}

function getQueueStatusText(queue: QueueStats) {
  if (queue.error) return "Error";
  if (queue.paused) return "Paused";
  if (queue.active > 0) return "Processing";
  if (queue.waiting > 0) return "Ready";
  return "Idle";
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Handle future dates
  if (diffMs < 0) {
    const absDiff = Math.abs(diffMs);
    if (absDiff < 60000) return `in ${Math.floor(absDiff / 1000)}s`;
    if (absDiff < 3600000) return `in ${Math.floor(absDiff / 60000)}m`;
    if (absDiff < 86400000) return `in ${Math.floor(absDiff / 3600000)}h`;
    return `in ${Math.floor(absDiff / 86400000)}d`;
  }

  // Handle past dates
  if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s ago`;
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
  return `${Math.floor(diffMs / 86400000)}d ago`;
}

function describeCronExpression(cron: string): string {
  // Common cron patterns to human-readable descriptions
  const patterns: Record<string, string> = {
    "0 * * * *": "Every hour",
    "*/5 * * * *": "Every 5 minutes",
    "*/10 * * * *": "Every 10 minutes",
    "*/15 * * * *": "Every 15 minutes",
    "*/30 * * * *": "Every 30 minutes",
    "0 */2 * * *": "Every 2 hours",
    "0 */4 * * *": "Every 4 hours",
    "0 */6 * * *": "Every 6 hours",
    "0 0 * * *": "Daily at midnight",
    "0 1 * * *": "Daily at 1 AM",
    "0 2 * * *": "Daily at 2 AM",
    "0 3 * * *": "Daily at 3 AM",
    "0 4 * * *": "Daily at 4 AM",
    "0 5 * * *": "Daily at 5 AM",
    "0 6 * * *": "Daily at 6 AM",
    "0 2 * * 1": "Weekly on Monday at 2 AM",
    "0 3 * * 0": "Weekly on Sunday at 3 AM",
    "0 6,18 * * *": "Twice daily at 6 AM and 6 PM",
    "*/30 7-22 * * *": "Every 30 min during business hours (7 AM - 10 PM)",
    "0 0 1 * *": "Monthly on the 1st at midnight",
  };

  return patterns[cron] || cron;
}

function getQueueHealth(queue: QueueStats): {
  status: "healthy" | "warning" | "critical";
  message: string;
} {
  // Check for errors
  if (queue.error) {
    return { status: "critical", message: "Queue has errors" };
  }

  // Calculate failure rate
  const totalProcessed = queue.completed + queue.failed;
  const failureRate = totalProcessed > 0 ? queue.failed / totalProcessed : 0;

  // Check if queue is stuck
  const lastProcessedTime = queue.lastProcessed
    ? new Date(queue.lastProcessed).getTime()
    : 0;
  const timeSinceLastProcessed = Date.now() - lastProcessedTime;
  const isStuck = queue.waiting > 0 && timeSinceLastProcessed > 300000; // 5 minutes

  // Critical conditions
  if (failureRate > 0.5) {
    return {
      status: "critical",
      message: `${(failureRate * 100).toFixed(0)}% failure rate`,
    };
  }
  if (isStuck) {
    return { status: "critical", message: "Queue appears stuck" };
  }
  if (queue.failed > 50) {
    return { status: "critical", message: `${queue.failed} failed jobs` };
  }

  // Warning conditions
  if (failureRate > 0.2) {
    return {
      status: "warning",
      message: `${(failureRate * 100).toFixed(0)}% failure rate`,
    };
  }
  if (queue.failed > 10) {
    return { status: "warning", message: `${queue.failed} failed jobs` };
  }
  if (queue.waiting > 100) {
    return { status: "warning", message: `${queue.waiting} jobs backlog` };
  }

  // Healthy
  return { status: "healthy", message: "Queue is healthy" };
}

export function QueueCard({
  queue,
  index,
  onViewLogs,
  onPause,
  onResume,
  onRetryFailed,
  onDrain,
  onConfigure,
  onTriggerJob,
}: QueueCardProps) {
  const health = getQueueHealth(queue);

  return (
    <motion.div
      key={queue.name}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 * index }}
    >
      <Card className="h-full hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{queue.displayName}</CardTitle>
                <CardDescription className="text-xs flex items-center gap-2">
                  <span>{queue.name}</span>
                  {health.status !== "healthy" && (
                    <span className="flex items-center gap-1">
                      {health.status === "warning" ? (
                        <AlertCircle className="h-3 w-3 text-yellow-600" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-600" />
                      )}
                      <span
                        className={cn(
                          "text-xs",
                          health.status === "warning"
                            ? "text-yellow-600"
                            : "text-red-600",
                        )}
                      >
                        {health.message}
                      </span>
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onConfigure(queue.name)}
                className="h-8 w-8"
                title="Configure queue"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Badge variant={getQueueStatusColor(queue)} className="text-xs">
                {getQueueStatusText(queue)}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Job Counts */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Waiting</span>
                <span className="text-sm font-medium">{queue.waiting}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Active</span>
                <span className="text-sm font-medium text-orange-600">
                  {queue.active}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Completed</span>
                <span className="text-sm font-medium text-green-600">
                  {queue.completed.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Failed</span>
                <span className="text-sm font-medium text-red-600">
                  {queue.failed}
                </span>
              </div>
            </div>
          </div>

          {/* Schedule Information */}
          {queue.config &&
            (queue.config.schedules || queue.config.activeSchedules) && (
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium">
                    {queue.config.activeSchedules || 0} active schedule
                    {queue.config.activeSchedules !== 1 ? "s" : ""}
                    {queue.config.schedules !== queue.config.activeSchedules &&
                      ` (${queue.config.schedules} total)`}
                  </span>
                </div>
                {queue.config.nextScheduledRun && (
                  <div className="bg-muted/50 rounded p-2 space-y-1">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Next run:
                      </span>
                      <span className="text-xs font-medium">
                        {formatTimeAgo(queue.config.nextScheduledRun.nextRunAt)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">
                        {describeCronExpression(
                          queue.config.nextScheduledRun.cronExpression,
                        )}
                      </span>
                      {" - "}
                      <span className="italic">
                        {queue.config.nextScheduledRun.name}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

          {/* Performance Metrics */}
          <div className="pt-2 border-t">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Processing Rate</span>
                <p className="font-medium">
                  {(queue.processingRate ?? 0) > 0
                    ? `${(queue.processingRate ?? 0).toFixed(1)}/min`
                    : queue.completed > 0
                      ? "< 0.1/min"
                      : "-"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Avg Duration</span>
                <p className="font-medium">
                  {(queue.avgProcessingTime ?? 0) > 0
                    ? formatDuration(queue.avgProcessingTime ?? 0)
                    : "-"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
              <div>
                <span className="text-muted-foreground">Success Rate</span>
                <p className="font-medium">
                  {queue.completed + queue.failed > 0
                    ? `${((queue.completed / (queue.completed + queue.failed)) * 100).toFixed(1)}%`
                    : "-"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Last Processed</span>
                <p className="font-medium">
                  {formatTimeAgo(queue.lastProcessed || null)}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button
              size="sm"
              variant="default"
              onClick={(e) => {
                e.stopPropagation();
                onViewLogs(queue.name, queue.displayName);
              }}
              className="flex items-center gap-1 text-xs"
            >
              <FileText className="h-3 w-3" />
              View Logs
            </Button>

            {queue.paused ? (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onResume(queue.name);
                }}
                className="flex items-center gap-1 text-xs"
              >
                <Play className="h-3 w-3" />
                Resume
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onPause(queue.name);
                }}
                className="flex items-center gap-1 text-xs"
              >
                <Pause className="h-3 w-3" />
                Pause
              </Button>
            )}

            {onTriggerJob && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onTriggerJob(queue.name);
                }}
                className="flex items-center gap-1 text-xs text-primary"
                title="Manually trigger a job"
              >
                <Zap className="h-3 w-3" />
                Trigger
              </Button>
            )}

            {queue.failed > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetryFailed(queue.name);
                }}
                className="flex items-center gap-1 text-xs"
              >
                <RotateCcw className="h-3 w-3" />
                Retry Failed
              </Button>
            )}

            {(queue.completed > 0 || queue.failed > 0) && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onDrain(queue.name);
                }}
                className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-3 w-3" />
                Drain
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
