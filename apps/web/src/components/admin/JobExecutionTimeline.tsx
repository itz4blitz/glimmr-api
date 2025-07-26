import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import {
  format,
  subHours,
  startOfHour,
  parseISO,
  isWithinInterval,
} from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  TrendingUp,
  Activity,
  BarChart3,
  Timer,
  CheckCircle,
  XCircle,
  AlertCircle,
  Zap
} from "lucide-react";

interface JobLog {
  id: string;
  jobId: string;
  level: "info" | "warning" | "error" | "success";
  message: string;
  createdAt: string;
  context?: {
    jobName?: string;
    duration?: number;
    state?: string;
    status?: string;
  };
}

interface JobExecutionTimelineProps {
  logs: JobLog[];
  queueName?: string;
}

type TimeRange = "1h" | "6h" | "12h" | "24h" | "7d";
type ChartType = "timeline" | "distribution" | "performance" | "states";

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    color: string;
    name: string;
    value: number;
  }>;
  label?: string;
}

export function JobExecutionTimeline({
  logs,
  queueName: _queueName, // Prefix with underscore to indicate it's intentionally unused
}: JobExecutionTimelineProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [chartType, setChartType] = useState<ChartType>("timeline");

  // Memoize the current time to avoid recreating Date objects
  const now = useMemo(() => new Date(), []); // Only calculate once on mount
  const startTime = useMemo(() => {
    switch (timeRange) {
      case "1h":
        return subHours(now, 1);
      case "6h":
        return subHours(now, 6);
      case "12h":
        return subHours(now, 12);
      case "24h":
        return subHours(now, 24);
      case "7d":
        return subHours(now, 168);
      default:
        return subHours(now, 24);
    }
  }, [timeRange, now]);

  // Filter logs by time range
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const logDate = parseISO(log.createdAt);
      return isWithinInterval(logDate, { start: startTime, end: now });
    });
  }, [logs, startTime, now]);

  // Process data for timeline chart
  const timelineData = useMemo(() => {
    const hourlyBuckets = new Map<
      string,
      {
        hour: string;
        completed: number;
        failed: number;
        active: number;
        waiting: number;
        total: number;
      }
    >();

    // Initialize buckets
    const hours = timeRange === "7d" ? 168 : parseInt(timeRange);
    for (let i = 0; i < hours; i++) {
      const hour = startOfHour(subHours(now, i));
      const key = format(hour, "yyyy-MM-dd HH:00");
      hourlyBuckets.set(key, {
        hour: key,
        completed: 0,
        failed: 0,
        active: 0,
        waiting: 0,
        total: 0,
      });
    }

    // Count jobs by status - improved detection
    filteredLogs.forEach((log) => {
      const hour = format(
        startOfHour(parseISO(log.createdAt)),
        "yyyy-MM-dd HH:00",
      );
      const bucket = hourlyBuckets.get(hour);
      if (bucket) {
        bucket.total++;

        const message = log.message.toLowerCase();

        // More comprehensive status detection
        if (log.level === "success" || message.includes("completed successfully") || message.includes("job completed")) {
          bucket.completed++;
        } else if (log.level === "error" || message.includes("failed") || message.includes("error")) {
          bucket.failed++;
        } else if (message.includes("processing") || message.includes("started") || message.includes("executing")) {
          bucket.active++;
        } else if (message.includes("queued") || message.includes("waiting") || message.includes("pending")) {
          bucket.waiting++;
        } else {
          // Default categorization based on level
          if (log.level === "info") {
            bucket.active++;
          } else if (log.level === "warning") {
            bucket.waiting++;
          }
        }
      }
    });

    const result = Array.from(hourlyBuckets.values())
      .sort((a, b) => a.hour.localeCompare(b.hour))
      .map((item) => ({
        ...item,
        hour: format(
          parseISO(item.hour),
          timeRange === "7d" ? "MM/dd" : "HH:mm",
        ),
      }));


    return result;
  }, [filteredLogs, timeRange, now]);

  // Process data for job distribution
  const distributionData = useMemo(() => {
    const jobCounts = new Map<string, number>();

    filteredLogs.forEach((log) => {
      const jobName = log.context?.jobName || "Unknown";
      jobCounts.set(jobName, (jobCounts.get(jobName) || 0) + 1);
    });

    return Array.from(jobCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 jobs
  }, [filteredLogs]);

  // Enhanced performance data processing
  const performanceData = useMemo(() => {
    const hourlyPerf = new Map<
      string,
      {
        hour: string;
        avgDuration: number;
        throughput: number;
        successRate: number;
        totalJobs: number;
        successfulJobs: number;
        failedJobs: number;
        durations: number[];
      }
    >();

    // Initialize buckets
    const hours = timeRange === "7d" ? 168 : parseInt(timeRange);
    for (let i = 0; i < hours; i++) {
      const hour = startOfHour(subHours(now, i));
      const key = format(hour, "yyyy-MM-dd HH:00");
      hourlyPerf.set(key, {
        hour: key,
        avgDuration: 0,
        throughput: 0,
        successRate: 0,
        totalJobs: 0,
        successfulJobs: 0,
        failedJobs: 0,
        durations: [],
      });
    }

    // Process all logs to extract performance metrics
    filteredLogs.forEach((log) => {
      const hour = format(
        startOfHour(parseISO(log.createdAt)),
        "yyyy-MM-dd HH:00",
      );
      const bucket = hourlyPerf.get(hour);
      if (bucket) {
        bucket.totalJobs++;

        // Extract duration from various sources
        let duration = log.context?.duration;
        if (!duration && log.message) {
          // Try to extract duration from message patterns
          const durationMatch = log.message.match(/(\d+(?:\.\d+)?)\s*(ms|seconds?|s)/i);
          if (durationMatch) {
            const value = parseFloat(durationMatch[1]);
            const unit = durationMatch[2].toLowerCase();
            duration = unit.startsWith('s') ? value * 1000 : value;
          }
        }

        if (duration && duration > 0) {
          bucket.durations.push(duration);
        }

        // Track success/failure
        if (log.level === "success" || log.message.toLowerCase().includes("completed successfully")) {
          bucket.successfulJobs++;
        } else if (log.level === "error" || log.message.toLowerCase().includes("failed")) {
          bucket.failedJobs++;
        }
      }
    });

    return Array.from(hourlyPerf.values())
      .sort((a, b) => a.hour.localeCompare(b.hour))
      .map((item) => {
        // Calculate average duration
        const avgDuration = item.durations.length > 0
          ? item.durations.reduce((sum, d) => sum + d, 0) / item.durations.length
          : 0;

        // Calculate success rate
        const successRate = item.totalJobs > 0
          ? (item.successfulJobs / item.totalJobs) * 100
          : 0;

        // Calculate throughput (jobs per hour)
        const throughput = item.totalJobs;

        return {
          hour: format(
            parseISO(item.hour),
            timeRange === "7d" ? "MM/dd" : "HH:mm",
          ),
          avgDuration: Math.round(avgDuration),
          throughput,
          successRate: Math.round(successRate * 10) / 10, // Round to 1 decimal
        };
      })
      .filter(item => item.throughput > 0 || item.avgDuration > 0); // Only show hours with data
  }, [filteredLogs, timeRange, now]);

  // Enhanced states/status data processing (works for all queue types)
  const stateData = useMemo(() => {
    const statusCounts = new Map<
      string,
      {
        status: string;
        count: number;
        successCount: number;
        errorCount: number;
        avgDuration: number;
        durations: number[];
        lastSeen: string;
      }
    >();

    filteredLogs.forEach((log) => {
      // Extract status from various sources
      let status = log.context?.state || log.context?.status;

      // If no explicit status, derive from message patterns
      if (!status) {
        if (log.message.toLowerCase().includes("processing")) {
          status = "Processing";
        } else if (log.message.toLowerCase().includes("completed")) {
          status = "Completed";
        } else if (log.message.toLowerCase().includes("failed")) {
          status = "Failed";
        } else if (log.message.toLowerCase().includes("started")) {
          status = "Started";
        } else if (log.message.toLowerCase().includes("queued")) {
          status = "Queued";
        } else {
          status = log.level.charAt(0).toUpperCase() + log.level.slice(1);
        }
      }

      const existing = statusCounts.get(status) || {
        status,
        count: 0,
        successCount: 0,
        errorCount: 0,
        avgDuration: 0,
        durations: [],
        lastSeen: log.createdAt,
      };

      existing.count++;
      existing.lastSeen = log.createdAt; // Update to most recent

      if (log.level === "success") {
        existing.successCount++;
      } else if (log.level === "error") {
        existing.errorCount++;
      }

      // Extract duration if available
      const duration = log.context?.duration;
      if (duration && duration > 0) {
        existing.durations.push(duration);
      }

      statusCounts.set(status, existing);
    });

    return Array.from(statusCounts.values())
      .map(item => ({
        ...item,
        avgDuration: item.durations.length > 0
          ? Math.round(item.durations.reduce((sum, d) => sum + d, 0) / item.durations.length)
          : 0,
        successRate: item.count > 0 ? Math.round((item.successCount / item.count) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Top 8 statuses
  }, [filteredLogs]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    const completed = filteredLogs.filter(
      (l) => l.level === "success" && l.message.includes("completed"),
    ).length;
    const failed = filteredLogs.filter((l) => l.level === "error").length;
    const total = filteredLogs.length;
    const successRate =
      total > 0 ? ((completed / total) * 100).toFixed(1) : "0";

    const durations = filteredLogs
      .filter((l) => l.context?.duration)
      .map((l) => l.context?.duration ?? 0)
      .filter(d => d > 0);

    const avgDuration =
      durations.length > 0
        ? Math.round(
            durations.reduce((a, b) => a + b, 0) / durations.length / 1000,
          )
        : 0;

    return { completed, failed, total, successRate, avgDuration };
  }, [filteredLogs]);

  // Enhanced custom tooltip with theme support
  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600 dark:text-gray-400">{entry.name}:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{entry.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Job Execution Timeline
            </CardTitle>
            <CardDescription>
              Monitor job execution patterns and performance
            </CardDescription>
          </div>

          <div className="flex items-center gap-4">
            {/* Enhanced Summary Stats */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/20 px-3 py-1.5 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-700 dark:text-green-300">
                  {stats.completed}
                </span>
                <span className="text-green-600 dark:text-green-400 text-xs">completed</span>
              </div>

              {stats.failed > 0 && (
                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/20 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-red-700 dark:text-red-300">
                    {stats.failed}
                  </span>
                  <span className="text-red-600 dark:text-red-400 text-xs">failed</span>
                </div>
              )}

              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/20 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-700 dark:text-blue-300">
                  {stats.successRate}%
                </span>
                <span className="text-blue-600 dark:text-blue-400 text-xs">success</span>
              </div>

              {stats.avgDuration > 0 && (
                <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-950/20 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800">
                  <Timer className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-purple-700 dark:text-purple-300">
                    {stats.avgDuration}s
                  </span>
                  <span className="text-purple-600 dark:text-purple-400 text-xs">avg</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between">
            <Tabs
              value={chartType}
              onValueChange={(v) => setChartType(v as ChartType)}
            >
              <TabsList>
                <TabsTrigger
                  value="timeline"
                  className="flex items-center gap-2"
                >
                  <Clock className="h-4 w-4" />
                  Timeline
                </TabsTrigger>
                <TabsTrigger
                  value="distribution"
                  className="flex items-center gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  Distribution
                </TabsTrigger>
                <TabsTrigger
                  value="performance"
                  className="flex items-center gap-2"
                >
                  <TrendingUp className="h-4 w-4" />
                  Performance
                </TabsTrigger>
                <TabsTrigger
                  value="states"
                  className="flex items-center gap-2"
                >
                  <Activity className="h-4 w-4" />
                  States
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Select
              value={timeRange}
              onValueChange={(v) => setTimeRange(v as TimeRange)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="6h">Last 6 Hours</SelectItem>
                <SelectItem value="12h">Last 12 Hours</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Enhanced Charts */}
          <div className="h-80 bg-background/50 rounded-lg border border-border/50 p-2">
            {chartType === "timeline" && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <defs>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="colorWaiting" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted/20"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="hour"
                    className="text-xs"
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 12
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 12
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{
                      color: "hsl(var(--foreground))",
                      fontSize: "12px"
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="completed"
                    stackId="1"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#colorCompleted)"
                    name="Completed"
                  />
                  <Area
                    type="monotone"
                    dataKey="active"
                    stackId="1"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#colorActive)"
                    name="Active"
                  />
                  {/* Only render failed area if there are actual failed jobs */}
                  {timelineData.some(d => d.failed > 0) && (
                    <Area
                      type="monotone"
                      dataKey="failed"
                      stackId="1"
                      stroke="#ef4444"
                      strokeWidth={2}
                      fill="url(#colorFailed)"
                      name="Failed"
                    />
                  )}
                  {timelineData.some(d => d.waiting > 0) && (
                    <Area
                      type="monotone"
                      dataKey="waiting"
                      stackId="1"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fill="url(#colorWaiting)"
                      name="Waiting"
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            )}

            {chartType === "distribution" && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionData} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 10 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted/20"
                    horizontal={true}
                    vertical={false}
                  />
                  <XAxis
                    type="number"
                    className="text-xs"
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 12
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    className="text-xs"
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11
                    }}
                    width={120}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="count"
                    fill="#3b82f6"
                    radius={[0, 6, 6, 0]}
                    className="hover:opacity-80 transition-opacity"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}

            {chartType === "performance" && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={performanceData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted/20"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="hour"
                    className="text-xs"
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 12
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    className="text-xs"
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 12
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    className="text-xs"
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 12
                    }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{
                      color: "hsl(var(--foreground))",
                      fontSize: "12px"
                    }}
                  />

                  <Bar
                    yAxisId="left"
                    dataKey="avgDuration"
                    fill="#8b5cf6"
                    name="Avg Duration (ms)"
                    radius={[4, 4, 0, 0]}
                    fillOpacity={0.8}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="throughput"
                    fill="#3b82f6"
                    name="Jobs/Hour"
                    radius={[4, 4, 0, 0]}
                    fillOpacity={0.6}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="successRate"
                    stroke="#10b981"
                    strokeWidth={3}
                    name="Success Rate (%)"
                    dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: "#10b981", strokeWidth: 2 }}
                  />
                  <ReferenceLine
                    yAxisId="right"
                    y={95}
                    stroke="#10b981"
                    strokeDasharray="5 5"
                    strokeOpacity={0.5}
                    label={{
                      value: "Target 95%",
                      position: "top" as const,
                      style: { fill: "hsl(var(--muted-foreground))", fontSize: 11 }
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}

            {chartType === "states" && stateData.length > 0 && (
              <div className="space-y-4">
                {/* Status Overview Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {stateData.slice(0, 4).map((state) => (
                    <div key={state.status} className="bg-muted/30 rounded-lg p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        {state.status === "Completed" && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {state.status === "Failed" && <XCircle className="h-4 w-4 text-red-500" />}
                        {state.status === "Processing" && <Zap className="h-4 w-4 text-blue-500" />}
                        {!["Completed", "Failed", "Processing"].includes(state.status) && <AlertCircle className="h-4 w-4 text-orange-500" />}
                        <span className="text-xs font-medium text-muted-foreground">{state.status}</span>
                      </div>
                      <div className="text-lg font-bold">{state.count}</div>
                      <div className="text-xs text-muted-foreground">
                        {state.successRate}% success
                      </div>
                    </div>
                  ))}
                </div>

                {/* Enhanced States Chart */}
                <ResponsiveContainer width="100%" height="60%">
                  <BarChart data={stateData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted/20"
                      horizontal={true}
                      vertical={false}
                    />
                    <XAxis
                      type="number"
                      className="text-xs"
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 12
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="status"
                      className="text-xs"
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 11
                      }}
                      width={80}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{
                        color: "hsl(var(--foreground))",
                        fontSize: "12px"
                      }}
                    />

                    <Bar
                      dataKey="count"
                      fill="#3b82f6"
                      radius={[0, 6, 6, 0]}
                      name="Job Count"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {chartType === "states" && stateData.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2">
                <Activity className="h-8 w-8 opacity-50" />
                <p className="text-sm">No status data available for this time range</p>
                <p className="text-xs opacity-75">Try selecting a different time range or check if jobs are running</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}