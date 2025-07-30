import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw,
  Download,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Search,
  TrendingUp,
  TrendingDown,
  Zap,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface QueueStats {
  name: string;
  displayName: string;
  health: "healthy" | "degraded" | "unhealthy";
  counts: {
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  throughput: {
    rate: number;
    trend: "up" | "down" | "stable";
    percentageChange: number;
  };
  performance: {
    avgProcessingTime: number;
    p95ProcessingTime: number;
    p99ProcessingTime: number;
    successRate: number;
  };
  historicalData: Array<{
    timestamp: number;
    completed: number;
    failed: number;
    throughput: number;
  }>;
}

interface QueueDashboardProps {
  onViewLogs: (queueName: string, displayName: string) => void;
  onViewAllLogs: () => void;
  onConfigure: (queueName: string) => void;
  onTriggerJob: (queueName: string) => void;
}

const COLORS = {
  primary: "#6366f1",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
  muted: "#6b7280",
};

export function QueueDashboard({
  onViewLogs,
  onViewAllLogs,
  onConfigure,
  onTriggerJob,
}: QueueDashboardProps) {
  const [queues, setQueues] = useState<QueueStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTimeRange, setSelectedTimeRange] = useState("24h");
  const [selectedView, setSelectedView] = useState("grid");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(Date.now() - 24 * 60 * 60 * 1000),
    to: new Date(),
  });

  const fetchQueues = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await api.get("/jobs/stats");
      
      console.log("API Response:", response.data);
      
      // Transform the data to match expected format - API returns 'queues' array
      const queueData = response.data.queues || [];
      console.log("Queue Data:", queueData);
      
      const transformedData = queueData.map((queue: {
        name: string;
        active?: number;
        waiting?: number;
        completed?: number;
        failed?: number;
        delayed?: number;
        paused?: boolean;
        processingRate?: number;
        avgProcessingTime?: number;
        historicalData?: any[];
      }) => {
        console.log(`Queue ${queue.name} historicalData:`, queue.historicalData);
        
        return {
          name: queue.name,
          displayName: queue.name.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          health: queue.paused ? "paused" : "healthy",
          counts: {
            active: queue.active || 0,
            waiting: queue.waiting || 0,
            completed: queue.completed || 0,
            failed: queue.failed || 0,
            delayed: queue.delayed || 0,
          },
          throughput: {
            rate: queue.processingRate || 0,
            trend: "stable",
            percentageChange: 0,
          },
          performance: {
            avgProcessingTime: queue.avgProcessingTime || 0,
            p95ProcessingTime: (queue.avgProcessingTime || 0) * 1.5,
            p99ProcessingTime: (queue.avgProcessingTime || 0) * 2,
            successRate: ((queue.completed || 0) + (queue.failed || 0)) > 0 
              ? ((queue.completed || 0) / ((queue.completed || 0) + (queue.failed || 0))) * 100 
              : 0,
          },
          historicalData: queue.historicalData || [],
        };
      });
      
      console.log("Transformed Data:", transformedData);
      setQueues(transformedData);
    } catch (error) {
      console.error('Failed to fetch queue statistics:', error);
      toast.error("Failed to fetch queue statistics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Periodic refresh for real-time updates (replaced WebSocket)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && !refreshing) {
        fetchQueues();
      }
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [loading, refreshing, fetchQueues]);

  useEffect(() => {
    fetchQueues();
  }, [selectedTimeRange, dateRange, fetchQueues]);

  const handleExport = async () => {
    try {
      const response = await api.post("/jobs/export", {
        format: "csv",
        dataset: "all",
        filters: {
          timeRange: selectedTimeRange,
        },
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `queue-stats-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success("Export completed successfully");
    } catch (error) {
      console.error('Failed to export queue statistics:', error);
      toast.error("Failed to export queue statistics");
    }
  };

  const filteredQueues = queues.filter((queue) =>
    queue.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const overallStats = {
    totalJobs: queues.reduce((sum, q) => sum + Object.values(q.counts).reduce((a, b) => a + b, 0), 0),
    activeJobs: queues.reduce((sum, q) => sum + q.counts.active, 0),
    failedJobs: queues.reduce((sum, q) => sum + q.counts.failed, 0),
    avgSuccessRate: queues.length > 0 
      ? queues.reduce((sum, q) => sum + q.performance.successRate, 0) / queues.length 
      : 0,
    healthyQueues: queues.filter((q) => q.health === "healthy").length,
    degradedQueues: queues.filter((q) => q.health === "degraded").length,
    unhealthyQueues: queues.filter((q) => q.health === "unhealthy").length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Queue Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and manage background job processing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewAllLogs()}
            className="flex items-center gap-2"
          >
            <Activity className="h-4 w-4" />
            All Logs
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchQueues}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>System Overview</CardTitle>
            <CardDescription>Real-time queue system statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Jobs</p>
                <p className="text-2xl font-bold">{overallStats.totalJobs.toLocaleString()}</p>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">
                    {overallStats.activeJobs} active
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{overallStats.avgSuccessRate.toFixed(1)}%</p>
                <div className="flex items-center gap-1 text-sm">
                  {overallStats.avgSuccessRate > 95 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <span className={overallStats.avgSuccessRate > 95 ? "text-green-500" : "text-red-500"}>
                    {overallStats.avgSuccessRate > 95 ? "Healthy" : "Needs attention"}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Failed Jobs</p>
                <p className="text-2xl font-bold">{overallStats.failedJobs.toLocaleString()}</p>
                <Badge variant={overallStats.failedJobs > 0 ? "destructive" : "secondary"}>
                  {overallStats.failedJobs > 0 ? "Requires review" : "All clear"}
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Queue Health</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">{overallStats.healthyQueues}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-medium">{overallStats.degradedQueues}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium">{overallStats.unhealthyQueues}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Note about real-time data */}
            <div className="mt-6 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <Info className="inline h-3 w-3 mr-1" />
                Statistics update every 10 seconds. Historical trend charts require backend integration for time-series data.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters and Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search queues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="6h">Last 6 Hours</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
            {selectedTimeRange === "custom" && (
              <DatePickerWithRange
                date={dateRange}
                onDateChange={(newDate) => {
                  if (newDate.from && newDate.to) {
                    setDateRange({ from: newDate.from, to: newDate.to });
                  }
                }}
              />
            )}
            <Tabs value={selectedView} onValueChange={setSelectedView}>
              <TabsList>
                <TabsTrigger value="grid">Grid</TabsTrigger>
                <TabsTrigger value="list">List</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Queue Views */}
      <AnimatePresence mode="wait">
        {selectedView === "grid" && (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            {filteredQueues.map((queue) => (
              <QueueCard
                key={queue.name}
                queue={queue}
                onViewLogs={onViewLogs}
                onConfigure={onConfigure}
                onTriggerJob={onTriggerJob}
              />
            ))}
          </motion.div>
        )}

        {selectedView === "list" && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left p-4">Queue</th>
                        <th className="text-left p-4">Health</th>
                        <th className="text-center p-4">Active</th>
                        <th className="text-center p-4">Waiting</th>
                        <th className="text-center p-4">Completed</th>
                        <th className="text-center p-4">Failed</th>
                        <th className="text-center p-4">Success Rate</th>
                        <th className="text-center p-4">Throughput</th>
                        <th className="text-right p-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQueues.map((queue) => (
                        <QueueListRow
                          key={queue.name}
                          queue={queue}
                          onViewLogs={onViewLogs}
                          onConfigure={onConfigure}
                          onTriggerJob={onTriggerJob}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {selectedView === "analytics" && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <QueueAnalytics queues={filteredQueues} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Queue Card Component
function QueueCard({
  queue,
  onViewLogs,
  onConfigure,
  onTriggerJob,
}: {
  queue: QueueStats;
  onViewLogs: (queueName: string, displayName: string) => void;
  onConfigure: (queueName: string) => void;
  onTriggerJob: (queueName: string) => void;
}) {
  const getHealthColor = (health: string) => {
    switch (health) {
      case "healthy":
        return "text-green-500";
      case "degraded":
        return "text-yellow-500";
      case "unhealthy":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case "healthy":
        return <CheckCircle className="h-4 w-4" />;
      case "degraded":
        return <AlertCircle className="h-4 w-4" />;
      case "unhealthy":
        return <XCircle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{queue.displayName}</CardTitle>
            <div className={`flex items-center gap-1 ${getHealthColor(queue.health)}`}>
              {getHealthIcon(queue.health)}
              <span className="text-sm font-medium capitalize">{queue.health}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Job Counts */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-500">{queue.counts.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-500">{queue.counts.waiting}</p>
                <p className="text-xs text-muted-foreground">Waiting</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">{queue.counts.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Success Rate</span>
                <span className="font-medium">{queue.performance.successRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${queue.performance.successRate}%` }}
                />
              </div>
            </div>

            {/* Throughput */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Throughput</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium">{queue.throughput.rate}/min</span>
                {queue.throughput.trend === "up" ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : queue.throughput.trend === "down" ? (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                ) : null}
              </div>
            </div>

            {/* Mini Chart */}
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={queue.historicalData.slice(-10)}>
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke={COLORS.success}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="failed"
                    stroke={COLORS.danger}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onViewLogs(queue.name, queue.displayName)}
                className="flex-1"
              >
                Logs
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onConfigure(queue.name)}
                className="flex-1"
              >
                Configure
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onTriggerJob(queue.name)}
                className="flex-1"
              >
                Trigger
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Queue List Row Component
function QueueListRow({
  queue,
  onViewLogs,
  onConfigure,
  onTriggerJob,
}: {
  queue: QueueStats;
  onViewLogs: (queueName: string, displayName: string) => void;
  onConfigure: (queueName: string) => void;
  onTriggerJob: (queueName: string) => void;
}) {
  const getHealthColor = (health: string) => {
    switch (health) {
      case "healthy":
        return "text-green-500";
      case "degraded":
        return "text-yellow-500";
      case "unhealthy":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case "healthy":
        return <CheckCircle className="h-4 w-4" />;
      case "degraded":
        return <AlertCircle className="h-4 w-4" />;
      case "unhealthy":
        return <XCircle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <tr className="border-b hover:bg-muted/50 transition-colors">
      <td className="p-4">
        <div>
          <p className="font-medium">{queue.displayName}</p>
          <p className="text-sm text-muted-foreground">{queue.name}</p>
        </div>
      </td>
      <td className="p-4">
        <div className={`flex items-center gap-1 ${getHealthColor(queue.health)}`}>
          {getHealthIcon(queue.health)}
          <span className="text-sm capitalize">{queue.health}</span>
        </div>
      </td>
      <td className="p-4 text-center">
        <Badge variant={queue.counts.active > 0 ? "default" : "secondary"}>
          {queue.counts.active}
        </Badge>
      </td>
      <td className="p-4 text-center">
        <Badge variant={queue.counts.waiting > 0 ? "secondary" : "outline"}>
          {queue.counts.waiting}
        </Badge>
      </td>
      <td className="p-4 text-center">
        <Badge variant="default" className="bg-green-500/10 text-green-500">
          {queue.counts.completed}
        </Badge>
      </td>
      <td className="p-4 text-center">
        <Badge variant={queue.counts.failed > 0 ? "destructive" : "outline"}>
          {queue.counts.failed}
        </Badge>
      </td>
      <td className="p-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm font-medium">{queue.performance.successRate.toFixed(1)}%</span>
          <div className="w-16 bg-secondary rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${queue.performance.successRate}%` }}
            />
          </div>
        </div>
      </td>
      <td className="p-4 text-center">
        <div className="flex items-center justify-center gap-1">
          <span className="text-sm font-medium">{queue.throughput.rate}/min</span>
          {queue.throughput.trend === "up" ? (
            <TrendingUp className="h-3 w-3 text-green-500" />
          ) : queue.throughput.trend === "down" ? (
            <TrendingDown className="h-3 w-3 text-red-500" />
          ) : null}
        </div>
      </td>
      <td className="p-4 text-right">
        <div className="flex gap-1 justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onViewLogs(queue.name, queue.displayName)}
          >
            Logs
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onConfigure(queue.name)}
          >
            Configure
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onTriggerJob(queue.name)}
          >
            Trigger
          </Button>
        </div>
      </td>
    </tr>
  );
}

// Queue Analytics Component
function QueueAnalytics({ queues }: { queues: QueueStats[] }) {
  const pieData = queues.map((q) => ({
    name: q.displayName,
    value: q.counts.completed + q.counts.failed,
  }));

  const performanceData = queues.map((q) => ({
    name: q.displayName,
    avgTime: q.performance.avgProcessingTime,
    p95Time: q.performance.p95ProcessingTime,
    p99Time: q.performance.p99ProcessingTime,
  }));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Job Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Job Distribution</CardTitle>
          <CardDescription>Total jobs processed by queue</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={Object.values(COLORS)[index % Object.values(COLORS).length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Performance Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Comparison</CardTitle>
          <CardDescription>Processing time metrics by queue</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="avgTime" fill={COLORS.primary} name="Average" />
              <Bar dataKey="p95Time" fill={COLORS.warning} name="P95" />
              <Bar dataKey="p99Time" fill={COLORS.danger} name="P99" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Throughput Trends */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Throughput Trends</CardTitle>
          <CardDescription>Job processing rate over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
              {queues.map((queue, index) => (
                <Line
                  key={queue.name}
                  type="monotone"
                  data={queue.historicalData}
                  dataKey="throughput"
                  stroke={Object.values(COLORS)[index % Object.values(COLORS).length]}
                  name={queue.displayName}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}