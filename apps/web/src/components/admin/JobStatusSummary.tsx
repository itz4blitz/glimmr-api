import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  Download,
  FileText,
  Database,
  BarChart,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface JobStatusSummaryProps {
  log: {
    jobName?: string;
    queueName?: string;
    status?: string;
    message?: string;
    context?: Record<string, unknown> & {
      progress?: {
        percentage?: number;
        bytesDownloaded?: number;
        totalBytes?: number;
        speed?: number;
        eta?: string;
      };
    };
    timestamp: string;
    duration?: number;
  };
  elapsedTime?: string;
}

export function JobStatusSummary({ log, elapsedTime }: JobStatusSummaryProps) {
  // Determine job type and current action
  const getJobInfo = () => {
    const message = (log.message || "").toLowerCase();
    const queueName = (log.queueName || "").toLowerCase();

    // Determine job type
    let type = "generic";
    let icon = Activity;
    let action = "Processing";

    if (queueName.includes("download") || message.includes("download")) {
      type = "download";
      icon = Download;
      action = "Downloading";

      if (message.includes("validating")) action = "Validating file";
      else if (message.includes("starting download"))
        action = "Starting download";
      else if (message.includes("downloaded")) action = "Download progress";
      else if (message.includes("updating database"))
        action = "Saving metadata";
      else if (message.includes("queueing")) action = "Queueing for parsing";
    } else if (queueName.includes("parse") || message.includes("parse")) {
      type = "parse";
      icon = FileText;
      action = "Parsing";

      if (message.includes("reading")) action = "Reading file";
      else if (message.includes("parsing")) action = "Parsing data";
      else if (message.includes("validating")) action = "Validating records";
      else if (message.includes("saving")) action = "Saving to database";
    } else if (
      queueName.includes("analytics") ||
      message.includes("analytics")
    ) {
      type = "analytics";
      icon = BarChart;
      action = "Calculating";

      if (message.includes("aggregating")) action = "Aggregating data";
      else if (message.includes("calculating")) action = "Running calculations";
      else if (message.includes("updating")) action = "Updating metrics";
    } else if (queueName.includes("price") || message.includes("price")) {
      type = "price";
      icon = Database;
      action = "Processing prices";

      if (message.includes("normalizing")) action = "Normalizing prices";
      else if (message.includes("updating")) action = "Updating prices";
      else if (message.includes("validating")) action = "Validating prices";
    }

    // Extract key information from message
    const extractInfo = () => {
      const info: string[] = [];

      // Extract file name
      const fileMatch = message.match(
        /(?:file|downloading|parsing)\s+([^\s]+\.(csv|json|xml|txt))/i,
      );
      if (fileMatch) info.push(`File: ${fileMatch[1]}`);

      // Extract hospital ID
      const hospitalMatch = message.match(/hospital[:\s]+([a-f0-9-]+)/i);
      if (hospitalMatch)
        info.push(`Hospital: ${hospitalMatch[1].substring(0, 8)}...`);

      // Extract size info
      const sizeMatch = message.match(/(\d+(?:\.\d+)?)\s*(MB|GB|KB)/i);
      if (sizeMatch) info.push(`Size: ${sizeMatch[1]} ${sizeMatch[2]}`);

      // Extract record counts
      const recordMatch = message.match(/(\d+)\s*(?:records?|rows?|items?)/i);
      if (recordMatch) info.push(`Records: ${recordMatch[1]}`);

      return info;
    };

    return { type, icon, action, info: extractInfo() };
  };

  const jobInfo = getJobInfo();
  const Icon = jobInfo.icon;

  // Get status icon
  const getStatusIcon = () => {
    if (log.status === "completed" || log.message?.includes("completed")) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (log.status === "failed" || log.message?.includes("failed")) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    } else if (
      log.status === "active" ||
      log.message?.includes("processing") ||
      log.message?.includes("started")
    ) {
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    } else if (log.status === "waiting") {
      return <Clock className="h-4 w-4 text-gray-500" />;
    }
    return <Activity className="h-4 w-4 text-gray-400" />;
  };

  // Get progress info
  const progress = log.context?.progress as {
    percentage?: number;
    bytesDownloaded?: number;
    totalBytes?: number;
    speed?: number;
    eta?: string;
  } | undefined;
  const hasProgress =
    progress?.percentage !== undefined ||
    progress?.bytesDownloaded !== undefined;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border">
      <div className="flex-shrink-0 mt-0.5">
        <div className="relative">
          <Icon
            className={cn(
              "h-5 w-5",
              jobInfo.type === "download" && "text-blue-500",
              jobInfo.type === "parse" && "text-purple-500",
              jobInfo.type === "analytics" && "text-green-500",
              jobInfo.type === "price" && "text-orange-500",
            )}
          />
          <div className="absolute -bottom-1 -right-1">{getStatusIcon()}</div>
        </div>
      </div>

      <div className="flex-1 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm">{jobInfo.action}</h4>
              <Badge variant="outline" className="text-xs">
                {(log.queueName || "unknown").replace(/-/g, " ")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {log.message || "No message available"}
            </p>
          </div>

          {elapsedTime && (
            <div className="text-right">
              <p className="font-mono text-sm font-medium">{elapsedTime}</p>
              <p className="text-xs text-muted-foreground">elapsed</p>
            </div>
          )}
        </div>

        {jobInfo.info.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {jobInfo.info.map((info, i) => (
              <span
                key={i}
                className="text-xs bg-background px-2 py-0.5 rounded-md border"
              >
                {info}
              </span>
            ))}
          </div>
        )}

        {hasProgress && (
          <div className="space-y-1">
            {progress?.percentage !== undefined && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-mono font-medium">
                    {progress.percentage.toFixed(1)}%
                  </span>
                </div>
                <Progress value={progress.percentage} className="h-1.5" />
              </div>
            )}

            {(progress?.bytesDownloaded !== undefined ||
              progress?.speed !== undefined) && (
              <div className="flex gap-4 text-xs">
                {progress?.bytesDownloaded !== undefined && (
                  <span className="text-muted-foreground">
                    Downloaded:{" "}
                    <span className="font-mono text-foreground">
                      {(progress.bytesDownloaded / (1024 * 1024)).toFixed(1)} MB
                      {progress.totalBytes &&
                        ` / ${(progress.totalBytes / (1024 * 1024)).toFixed(1)} MB`}
                    </span>
                  </span>
                )}
                {progress?.speed !== undefined && progress.speed > 0 && (
                  <span className="text-muted-foreground">
                    Speed:{" "}
                    <span className="font-mono text-foreground">
                      {(progress.speed / (1024 * 1024)).toFixed(2)} MB/s
                    </span>
                  </span>
                )}
                {progress?.eta && (
                  <span className="text-muted-foreground">
                    ETA:{" "}
                    <span className="font-mono text-foreground">
                      {progress.eta}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
