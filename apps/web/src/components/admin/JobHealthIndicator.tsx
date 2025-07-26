import {
  AlertTriangle,
  AlertCircle,
  Clock,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface JobHealthIndicatorProps {
  startTime: string | Date;
  status: string;
  jobName?: string;
  message?: string;
  onRetry?: () => void;
  onCancel?: () => void;
  progress?: {
    percentage?: number;
    bytesDownloaded?: number;
    totalBytes?: number;
    speed?: number;
    eta?: string;
  };
}

export function JobHealthIndicator({
  startTime,
  
  jobName,
  message,
  onRetry,
  onCancel,
  progress,
}: JobHealthIndicatorProps) {
  const elapsedMs = Date.now() - new Date(startTime).getTime();
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const elapsedHours = Math.floor(elapsedMinutes / 60);

  // Determine job health based on duration and type
  const getHealthStatus = () => {
    if (
      jobName?.includes("download") ||
      message?.toLowerCase().includes("download")
    ) {
      // File download jobs
      if (elapsedHours > 2) return "critical"; // Downloads shouldn't take > 2 hours
      if (elapsedHours > 1) return "warning"; // Getting slow after 1 hour
      if (elapsedMinutes > 30) return "caution"; // 30+ minutes is concerning
      return "healthy";
    } else if (
      jobName?.includes("parse") ||
      message?.toLowerCase().includes("parse")
    ) {
      // Parsing jobs
      if (elapsedHours > 4) return "critical"; // Parsing shouldn't take > 4 hours
      if (elapsedHours > 2) return "warning";
      if (elapsedHours > 1) return "caution";
      return "healthy";
    } else {
      // Generic jobs
      if (elapsedHours > 6) return "critical";
      if (elapsedHours > 3) return "warning";
      if (elapsedHours > 1) return "caution";
      return "healthy";
    }
  };

  const health = getHealthStatus();

  const healthConfig = {
    critical: {
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-100 dark:bg-red-900/20",
      borderColor: "border-red-300 dark:border-red-800",
      message: "Job appears to be stuck",
      description:
        "This job has been running much longer than expected. It may be stuck or experiencing issues.",
    },
    warning: {
      icon: AlertTriangle,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-900/20",
      borderColor: "border-orange-300 dark:border-orange-800",
      message: "Running longer than usual",
      description:
        "This job is taking longer than typical. Monitor for potential issues.",
    },
    caution: {
      icon: AlertCircle,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100 dark:bg-yellow-900/20",
      borderColor: "border-yellow-300 dark:border-yellow-800",
      message: "Extended runtime",
      description:
        "This job is taking a while. This might be normal for large files.",
    },
    healthy: {
      icon: Clock,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
      borderColor: "border-blue-300 dark:border-blue-800",
      message: "Running normally",
      description: "Job is progressing within expected timeframes.",
    },
  };

  const config = healthConfig[health];
  const Icon = config.icon;

  // Format file size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Format speed
  const formatSpeed = (bytesPerSecond: number) => {
    return formatBytes(bytesPerSecond) + "/s";
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2",
        config.bgColor,
        config.borderColor,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-5 w-5", config.color)} />
          <div>
            <p className={cn("font-medium text-sm", config.color)}>
              {config.message}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {config.description}
            </p>
          </div>
        </div>

        {(health === "critical" || health === "warning") && (
          <div className="flex gap-1">
            {onRetry && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onRetry}
                      className="h-7 px-2"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Retry job</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {onCancel && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onCancel}
                      className="h-7 px-2 text-destructive hover:text-destructive"
                    >
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cancel job</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
      </div>

      {/* Progress information if available */}
      {progress &&
        (progress.percentage !== undefined ||
          progress.bytesDownloaded !== undefined) && (
          <div className="space-y-1.5 pt-1 border-t border-border/50">
            {progress.percentage !== undefined && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-mono">
                    {progress.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-background/50 rounded-full h-1.5">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, progress.percentage)}%` }}
                  />
                </div>
              </div>
            )}

            {progress.bytesDownloaded !== undefined && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Downloaded</span>
                <span className="font-mono">
                  {formatBytes(progress.bytesDownloaded)}
                  {progress.totalBytes &&
                    ` / ${formatBytes(progress.totalBytes)}`}
                </span>
              </div>
            )}

            {progress.speed !== undefined && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Speed</span>
                <span className="font-mono">{formatSpeed(progress.speed)}</span>
              </div>
            )}

            {progress.eta && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">ETA</span>
                <span className="font-mono">{progress.eta}</span>
              </div>
            )}
          </div>
        )}

      {/* Runtime details */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border/50">
        <span>Started: {new Date(startTime).toLocaleTimeString()}</span>
        {elapsedHours > 0 && (
          <Badge variant="outline" className="text-xs">
            {elapsedHours}+ hours runtime
          </Badge>
        )}
      </div>
    </div>
  );
}
