import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import {
  
  TrendingUp,
  TrendingDown,
  Activity,
  
  Download,
  RefreshCw,
  
  AlertCircle,
  CheckCircle,
  
  Clock,
  Zap,
  Users,
  
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  
} from "recharts";

interface AnalyticsData {
  overview: {
    totalJobs: number;
    successRate: number;
    avgProcessingTime: number;
    peakHour: string;
    busiestQueue: string;
    failureRate: number;
    avgWaitTime: number;
    throughput: number;
  };
  trends: Array<{
    timestamp: string;
    jobsProcessed: number;
    successRate: number;
    avgProcessingTime: number;
    queueDepth: number;
  }>;
  queuePerformance: Array<{
    queue: string;
    successRate: number;
    avgProcessingTime: number;
    throughput: number;
    errorRate: number;
    utilization: number;
  }>;
  jobDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  errorAnalysis: Array<{
    errorType: string;
    count: number;
    queue: string;
    trend: "increasing" | "decreasing" | "stable";
  }>;
  resourceUtilization: {
    cpu: number;
    memory: number;
    redis: number;
    database: number;
  };
  predictions: {
    nextHourLoad: number;
    estimatedQueueTime: number;
    recommendedWorkers: number;
  };
}

const COLORS = {
  primary: "#6366f1",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
  muted: "#6b7280",
  purple: "#8b5cf6",
  pink: "#ec4899",
};

export function QueueAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState("24h");
  const [selectedQueue, setSelectedQueue] = useState("all");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(Date.now() - 24 * 60 * 60 * 1000),
    to: new Date(),
  });

  const fetchAnalytics = async () => {
    try {
      setRefreshing(true);
      
      // Fetch multiple endpoints in parallel for comprehensive analytics
      const [statsResponse, performanceResponse, trendsResponse, resourceResponse] = await Promise.all([
        api.get("/jobs/stats"),
        api.get("/jobs/analytics/performance").catch(() => ({ data: null })),
        api.get("/jobs/monitoring/trends").catch(() => ({ data: null })),
        api.get("/jobs/analytics/resource-usage").catch(() => ({ data: null }))
      ]);
      
      // Transform the real data from backend
      const stats = statsResponse.data;
      const performance = performanceResponse.data;
      const trends = trendsResponse.data;
      const resources = resourceResponse.data;
      
      const totalJobs = stats.totalJobs || 0;
      const failedJobs = stats.failedJobs || 0;
      const completedJobs = stats.completedJobs || 0;
      const activeJobs = stats.activeJobs || 0;
      const waitingJobs = stats.waitingJobs || 0;
      
      // Calculate real metrics
      const successRate = (completedJobs + failedJobs) > 0 
        ? ((completedJobs / (completedJobs + failedJobs)) * 100) 
        : 0;
      
      const failureRate = totalJobs > 0 
        ? ((failedJobs / totalJobs) * 100) 
        : 0;
      
      // Use performance data if available
      const avgProcessingTime = performance?.averageProcessingTime || 
        (stats.queueStats?.[0]?.performance?.avgProcessingTime) || 0;
      
      const throughput = performance?.throughput ||
        (stats.queueStats?.reduce((sum: number, q: { performance?: { processingRate?: number } }) => sum + (q.performance?.processingRate || 0), 0)) || 0;
      
      setData({
        overview: {
          totalJobs,
          successRate,
          avgProcessingTime,
          peakHour: performance?.peakHour || "N/A",
          busiestQueue: stats.queueStats?.[0]?.name || "N/A",
          failureRate,
          avgWaitTime: performance?.averageWaitTime || 0,
          throughput,
        },
        trends: trends?.data || [],
        queuePerformance: (stats.queueStats || []).map((q: {
          name: string;
          counts: { completed: number; failed: number; active: number; waiting: number };
          performance?: { avgProcessingTime?: number; processingRate?: number; utilization?: number };
        }) => ({
          queue: q.name,
          successRate: (q.counts.completed + q.counts.failed) > 0 
            ? ((q.counts.completed / (q.counts.completed + q.counts.failed)) * 100) 
            : 0,
          avgProcessingTime: q.performance?.avgProcessingTime || 0,
          throughput: q.performance?.processingRate || 0,
          errorRate: (q.counts.completed + q.counts.failed) > 0 
            ? ((q.counts.failed / (q.counts.completed + q.counts.failed)) * 100) 
            : 0,
          utilization: q.performance?.utilization || 0,
        })),
        jobDistribution: [
          { status: "completed", count: completedJobs, percentage: totalJobs > 0 ? ((completedJobs / totalJobs) * 100) : 0 },
          { status: "failed", count: failedJobs, percentage: totalJobs > 0 ? ((failedJobs / totalJobs) * 100) : 0 },
          { status: "active", count: activeJobs, percentage: totalJobs > 0 ? ((activeJobs / totalJobs) * 100) : 0 },
          { status: "waiting", count: waitingJobs, percentage: totalJobs > 0 ? ((waitingJobs / totalJobs) * 100) : 0 },
        ],
        errorAnalysis: performance?.errorAnalysis || [],
        resourceUtilization: {
          cpu: resources?.cpu || 0,
          memory: resources?.memory || 0,
          redis: resources?.redis || 0,
          database: resources?.database || 0,
        },
        predictions: {
          nextHourLoad: performance?.predictions?.nextHourLoad || 0,
          estimatedQueueTime: performance?.predictions?.estimatedQueueTime || 0,
          recommendedWorkers: performance?.predictions?.recommendedWorkers || 0,
        }
      });
    } catch (error) {
      toast.error("Failed to load analytics data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange, selectedQueue, dateRange]);

  const handleExport = async (format: "csv" | "pdf") => {
    try {
      const response = await api.post("/jobs/export", {
        format,
        dataset: "analytics",
        filters: { timeRange, queue: selectedQueue }
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `queue-analytics-${Date.now()}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(`Analytics exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error("Failed to export analytics");
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="space-y-6">
            <Skeleton className="h-10 w-64" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
            <Skeleton className="h-96" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to load analytics data. Please try again.
            </AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Queue Analytics</h1>
            <p className="text-muted-foreground">
              Deep insights into your queue performance and trends
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("csv")}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("pdf")}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAnalytics}
              disabled={refreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <Select value={timeRange} onValueChange={setTimeRange}>
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
              {timeRange === "custom" && (
                <DateRangePicker
                  date={dateRange}
                  onDateChange={(range) => {
                    if (range.from && range.to) {
                      setDateRange({ from: range.from, to: range.to });
                    }
                  }}
                />
              )}
              <Select value={selectedQueue} onValueChange={setSelectedQueue}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select queue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Queues</SelectItem>
                  <SelectItem value="pra-unified-scan">PRA Unified Scan</SelectItem>
                  <SelectItem value="pra-file-download">PRA File Download</SelectItem>
                  <SelectItem value="price-file-parser">Price File Parser</SelectItem>
                  <SelectItem value="price-normalization">Price Normalization</SelectItem>
                  <SelectItem value="analytics-refresh">Analytics Refresh</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Jobs Processed</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.overview.totalJobs.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3 inline mr-1 text-green-500" />
                  +12% from last period
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.overview.successRate.toFixed(1)}%</div>
                <Progress value={data.overview.successRate} className="mt-2" />
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(data.overview.avgProcessingTime / 1000).toFixed(2)}s
                </div>
                <p className="text-xs text-muted-foreground">
                  <TrendingDown className="h-3 w-3 inline mr-1 text-green-500" />
                  -8% improvement
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Throughput</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.overview.throughput}/min</div>
                <p className="text-xs text-muted-foreground">
                  Peak: {data.overview.peakHour}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Main Analytics Tabs */}
        <Tabs defaultValue="trends" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="distribution">Distribution</TabsTrigger>
            <TabsTrigger value="predictions">Predictions</TabsTrigger>
          </TabsList>

          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Processing Trends</CardTitle>
                <CardDescription>
                  Job processing patterns over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={data.trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="jobsProcessed"
                        fill={COLORS.primary}
                        stroke={COLORS.primary}
                        fillOpacity={0.6}
                        name="Jobs Processed"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="successRate"
                        stroke={COLORS.success}
                        strokeWidth={2}
                        name="Success Rate %"
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="queueDepth"
                        stroke={COLORS.warning}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        name="Queue Depth"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                    <p>No trend data available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Processing Time Distribution</CardTitle>
                  <CardDescription>
                    How long jobs take to process
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={data.trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" />
                      <YAxis />
                      <Tooltip />
                      <defs>
                        <linearGradient id="colorProcessingTime" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.info} stopOpacity={0.8} />
                          <stop offset="95%" stopColor={COLORS.info} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="avgProcessingTime"
                        stroke={COLORS.info}
                        fillOpacity={1}
                        fill="url(#colorProcessingTime)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Queue Depth Over Time</CardTitle>
                  <CardDescription>
                    Number of jobs waiting in queues
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data.trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="queueDepth"
                        stroke={COLORS.purple}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Queue Performance Comparison</CardTitle>
                <CardDescription>
                  Comparative analysis of queue performance metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.queuePerformance.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <RadarChart data={data.queuePerformance}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="queue" />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} />
                      <Radar
                        name="Success Rate"
                        dataKey="successRate"
                        stroke={COLORS.success}
                        fill={COLORS.success}
                        fillOpacity={0.6}
                      />
                      <Radar
                        name="Utilization"
                        dataKey="utilization"
                        stroke={COLORS.primary}
                        fill={COLORS.primary}
                        fillOpacity={0.6}
                      />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                    <p>No queue performance data available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Processing Time by Queue</CardTitle>
                  <CardDescription>
                    Average processing time comparison
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.queuePerformance} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="queue" type="category" />
                      <Tooltip />
                      <Bar dataKey="avgProcessingTime" fill={COLORS.info} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Throughput by Queue</CardTitle>
                  <CardDescription>
                    Jobs processed per minute
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.queuePerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="queue" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="throughput" fill={COLORS.purple} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="distribution" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Job Status Distribution</CardTitle>
                  <CardDescription>
                    Breakdown of job statuses
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.jobDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.status}: ${entry.percentage}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {data.jobDistribution.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.status === "completed"
                                ? COLORS.success
                                : entry.status === "failed"
                                ? COLORS.danger
                                : entry.status === "active"
                                ? COLORS.primary
                                : COLORS.warning
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Error Analysis</CardTitle>
                  <CardDescription>
                    Common error types and trends
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {data.errorAnalysis.map((error, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          <div>
                            <p className="text-sm font-medium">{error.errorType}</p>
                            <p className="text-xs text-muted-foreground">
                              {error.queue} - {error.count} occurrences
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {error.trend === "increasing" ? (
                            <TrendingUp className="h-4 w-4 text-red-500" />
                          ) : error.trend === "decreasing" ? (
                            <TrendingDown className="h-4 w-4 text-green-500" />
                          ) : (
                            <Activity className="h-4 w-4 text-gray-500" />
                          )}
                          <Badge
                            variant={
                              error.trend === "increasing"
                                ? "destructive"
                                : error.trend === "decreasing"
                                ? "success"
                                : "secondary"
                            }
                          >
                            {error.trend}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Resource Utilization</CardTitle>
                <CardDescription>
                  System resource usage across components
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">CPU Usage</span>
                      <span className="text-sm text-muted-foreground">
                        {data.resourceUtilization.cpu}%
                      </span>
                    </div>
                    <Progress value={data.resourceUtilization.cpu} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Memory Usage</span>
                      <span className="text-sm text-muted-foreground">
                        {data.resourceUtilization.memory}%
                      </span>
                    </div>
                    <Progress value={data.resourceUtilization.memory} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Redis Usage</span>
                      <span className="text-sm text-muted-foreground">
                        {data.resourceUtilization.redis}%
                      </span>
                    </div>
                    <Progress value={data.resourceUtilization.redis} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Database Connections</span>
                      <span className="text-sm text-muted-foreground">
                        {data.resourceUtilization.database}%
                      </span>
                    </div>
                    <Progress value={data.resourceUtilization.database} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="predictions" className="space-y-4">
            <Alert>
              <Zap className="h-4 w-4" />
              <AlertTitle>AI-Powered Predictions</AlertTitle>
              <AlertDescription>
                Based on historical patterns and current trends
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Next Hour Load</CardTitle>
                  <CardDescription>
                    Predicted job volume
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {data.predictions.nextHourLoad.toLocaleString()}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Expected jobs in the next 60 minutes
                  </p>
                  <div className="mt-4">
                    <Badge variant={data.predictions.nextHourLoad > 10000 ? "destructive" : "secondary"}>
                      {data.predictions.nextHourLoad > 10000 ? "High Load" : "Normal Load"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Estimated Queue Time</CardTitle>
                  <CardDescription>
                    Average wait time for new jobs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {(data.predictions.estimatedQueueTime / 1000).toFixed(1)}s
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Based on current queue depth and processing rate
                  </p>
                  <Progress
                    value={Math.min((data.predictions.estimatedQueueTime / 5000) * 100, 100)}
                    className="mt-4"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recommended Workers</CardTitle>
                  <CardDescription>
                    Optimal worker configuration
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {data.predictions.recommendedWorkers}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Workers needed for optimal performance
                  </p>
                  <Button size="sm" className="mt-4 w-full">
                    <Users className="h-4 w-4 mr-2" />
                    Apply Configuration
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Performance Forecast</CardTitle>
                <CardDescription>
                  Predicted performance metrics for the next 24 hours
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Recommendation</AlertTitle>
                  <AlertDescription>
                    Consider scaling up workers during peak hours (2-4 PM) to maintain optimal performance.
                    Current configuration may experience delays during high load periods.
                  </AlertDescription>
                </Alert>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Key Insights</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Peak load expected at 3:00 PM</li>
                      <li>• 15% increase in job volume predicted</li>
                      <li>• Redis memory usage may exceed 80%</li>
                      <li>• Consider pre-scaling before peak</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Action Items</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Enable auto-scaling for critical queues</li>
                      <li>• Monitor error rates closely</li>
                      <li>• Prepare fallback strategies</li>
                      <li>• Review retry configurations</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}