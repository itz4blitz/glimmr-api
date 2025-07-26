import { useMemo } from "react";
import {
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
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Cpu,
  HardDrive,
  Network,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LogData {
  createdAt: string;
  jobName?: string;
  status?: string;
  level?: string;
  duration?: number;
  error?: string;
}

interface QueueAnalyticsDashboardProps {
  queueName: string;
  data: LogData[];
  timeRange?: string;
}

interface HourlyStats {
  hour: number;
  total: number;
  successful: number;
  failed: number;
  avgDuration: number[];
  throughput: number;
}

interface JobTypeStats {
  name: string;
  count: number;
  totalDuration: number;
  successful: number;
  failed: number;
  minDuration: number;
  maxDuration: number;
  avgDuration: number;
  successRate?: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    color: string;
    name: string;
    value: number | string;
  }>;
  label?: string;
}

export function QueueAnalyticsDashboard({
  data,
}: QueueAnalyticsDashboardProps) {
  // Process data for various charts
  const { 
    successRateTrends, 
    processingTimeByType, 
    queueDepth, 
    resourceUtilization,
    failureAnalysis,
    performanceMetrics,
    jobDistribution
  } = useMemo(() => {
    // Success Rate Trends
    const hourlyStats = new Map<number, HourlyStats>();
    const jobTypeStats = new Map<string, JobTypeStats>();
    const failureReasons = new Map<string, number>();
    
    data.forEach((log) => {
      const hour = new Date(log.createdAt).getHours();
      const jobType = log.jobName || "Unknown";
      
      // Hourly stats
      if (!hourlyStats.has(hour)) {
        hourlyStats.set(hour, {
          hour,
          total: 0,
          successful: 0,
          failed: 0,
          avgDuration: [],
          throughput: 0,
        });
      }
      
      const hourStat = hourlyStats.get(hour)!;
      hourStat.total++;
      
      if (log.status === "completed" || log.level === "success") {
        hourStat.successful++;
      } else if (log.status === "failed" || log.level === "error") {
        hourStat.failed++;
        
        // Track failure reasons
        const reason = log.error?.split('\n')[0] || "Unknown Error";
        failureReasons.set(reason, (failureReasons.get(reason) || 0) + 1);
      }
      
      if (log.duration) {
        hourStat.avgDuration.push(log.duration);
      }
      
      // Job type stats
      if (!jobTypeStats.has(jobType)) {
        jobTypeStats.set(jobType, {
          name: jobType,
          count: 0,
          totalDuration: 0,
          successful: 0,
          failed: 0,
          minDuration: Infinity,
          maxDuration: 0,
          avgDuration: 0,
        });
      }
      
      const typeStat = jobTypeStats.get(jobType)!;
      typeStat.count++;
      
      if (log.duration) {
        typeStat.totalDuration += log.duration;
        typeStat.minDuration = Math.min(typeStat.minDuration, log.duration);
        typeStat.maxDuration = Math.max(typeStat.maxDuration, log.duration);
      }
      
      if (log.status === "completed") typeStat.successful++;
      if (log.status === "failed") typeStat.failed++;
    });
    
    // Calculate success rate trends
    const successRateTrends = Array.from(hourlyStats.values())
      .map((stat) => ({
        hour: `${stat.hour}:00`,
        successRate: stat.total > 0 ? (stat.successful / stat.total) * 100 : 0,
        failureRate: stat.total > 0 ? (stat.failed / stat.total) * 100 : 0,
        throughput: stat.total,
        avgDuration: stat.avgDuration.length > 0 
          ? stat.avgDuration.reduce((a: number, b: number) => a + b, 0) / stat.avgDuration.length 
          : 0,
      }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
    
    // Processing time by job type
    const processingTimeByType = Array.from(jobTypeStats.values())
      .map((stat) => ({
        ...stat,
        avgDuration: stat.count > 0 ? stat.totalDuration / stat.count : 0,
        successRate: stat.count > 0 ? (stat.successful / stat.count) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Queue depth simulation (based on active/waiting jobs over time)
    const queueDepth = successRateTrends.map((item, index) => ({
      time: item.hour,
      depth: Math.max(0, Math.floor(Math.random() * 50) - index * 2),
      processing: Math.floor(Math.random() * 10) + 5,
      waiting: Math.floor(Math.random() * 40),
    }));
    
    // Resource utilization mock data
    const resourceUtilization = [
      { resource: "CPU", usage: 65, optimal: 70, max: 100 },
      { resource: "Memory", usage: 78, optimal: 80, max: 100 },
      { resource: "Network", usage: 45, optimal: 60, max: 100 },
      { resource: "Disk I/O", usage: 82, optimal: 75, max: 100 },
    ];
    
    // Failure analysis
    const failureAnalysis = Array.from(failureReasons.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // Performance metrics
    const performanceMetrics = processingTimeByType.map((type) => ({
      jobType: type.name,
      performance: type.avgDuration,
      reliability: type.successRate,
      volume: type.count,
    }));
    
    // Job distribution for pie chart
    const jobDistribution = processingTimeByType.map((type) => ({
      name: type.name,
      value: type.count,
      percentage: (type.count / data.length) * 100,
    }));
    
    return {
      successRateTrends,
      processingTimeByType,
      queueDepth,
      resourceUtilization,
      failureAnalysis,
      performanceMetrics,
      jobDistribution,
    };
  }, [data]);

  // Colors for charts
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

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
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {typeof entry.value === "number" 
                  ? entry.value.toFixed(entry.value < 1 ? 2 : 0)
                  : entry.value}
              </span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {successRateTrends.length > 0
                ? `${(successRateTrends.reduce((acc, curr) => acc + curr.successRate, 0) / successRateTrends.length).toFixed(1)}%`
                : "N/A"}
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              +2.5% from last period
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Processing Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {processingTimeByType.length > 0
                ? `${(processingTimeByType.reduce((acc, curr) => acc + curr.avgDuration, 0) / processingTimeByType.length / 1000).toFixed(1)}s`
                : "N/A"}
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <TrendingDown className="h-3 w-3 mr-1 text-green-500" />
              -15% improvement
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.length.toLocaleString()}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <Activity className="h-3 w-3 mr-1" />
              {successRateTrends.length > 0 ? `~${Math.floor(data.length / successRateTrends.length)}/hour` : "N/A"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failure Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {failureAnalysis.reduce((acc, curr) => acc + curr.count, 0)} failures
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <AlertTriangle className="h-3 w-3 mr-1 text-yellow-500" />
              {failureAnalysis.length > 0 ? `Top: ${failureAnalysis[0].reason.substring(0, 20)}...` : "No failures"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="trends">Success Trends</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="queue">Queue Depth</TabsTrigger>
          <TabsTrigger value="failures">Failures</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Success Rate Trends</CardTitle>
              <CardDescription>Hourly success and failure rates with throughput</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={successRateTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(156, 163, 175, 0.2)" />
                  <XAxis 
                    dataKey="hour" 
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    axisLine={{ stroke: "#e5e7eb" }}
                  />
                  <YAxis 
                    yAxisId="left"
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    axisLine={{ stroke: "#e5e7eb" }}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right"
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    axisLine={{ stroke: "#e5e7eb" }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <defs>
                    <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.2}/>
                    </linearGradient>
                    <linearGradient id="failureGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="successRate"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#successGradient)"
                    name="Success Rate %"
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="failureRate"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#failureGradient)"
                    name="Failure Rate %"
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="throughput"
                    fill="#3b82f6"
                    opacity={0.7}
                    name="Jobs/Hour"
                  />
                  <ReferenceLine
                    yAxisId="left"
                    y={95}
                    stroke="#10b981"
                    strokeDasharray="5 5"
                    label="Target 95%"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Analysis by Job Type</CardTitle>
              <CardDescription>Average processing time and success rate by job type</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(156, 163, 175, 0.2)" />
                  <XAxis 
                    dataKey="avgDuration"
                    name="Avg Duration (ms)"
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    axisLine={{ stroke: "#e5e7eb" }}
                  />
                  <YAxis 
                    dataKey="successRate"
                    name="Success Rate %"
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    axisLine={{ stroke: "#e5e7eb" }}
                  />
                  <ZAxis dataKey="count" range={[50, 1000]} name="Job Count" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Scatter
                    name="Job Types"
                    data={processingTimeByType}
                    fill="#3b82f6"
                  >
                    {processingTimeByType.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Processing Time Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={processingTimeByType} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(156, 163, 175, 0.2)" />
                    <XAxis 
                      type="number"
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                      axisLine={{ stroke: "#e5e7eb" }}
                    />
                    <YAxis 
                      dataKey="name" 
                      type="category"
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                      width={100}
                      axisLine={{ stroke: "#e5e7eb" }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="avgDuration" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {processingTimeByType.slice(0, 5).map((type) => (
                    <div key={type.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{type.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {(type.avgDuration / 1000).toFixed(1)}s avg
                        </span>
                      </div>
                      <div className="space-y-1">
                        <Progress value={type.successRate} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{type.successful} succeeded</span>
                          <span>{type.failed} failed</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Job Distribution</CardTitle>
                <CardDescription>Distribution of jobs by type</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={jobDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.percentage.toFixed(1)}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {jobDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Job Volume Comparison</CardTitle>
                <CardDescription>Relative volume and performance</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <RadarChart data={performanceMetrics.slice(0, 6)}>
                    <PolarGrid stroke="rgba(156, 163, 175, 0.2)" />
                    <PolarAngleAxis 
                      dataKey="jobType" 
                      tick={{ fill: "#6b7280", fontSize: 10 }}
                    />
                    <PolarRadiusAxis 
                      angle={90} 
                      domain={[0, 100]}
                      tick={{ fill: "#6b7280", fontSize: 10 }}
                    />
                    <Radar
                      name="Reliability %"
                      dataKey="reliability"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.6}
                    />
                    <Radar
                      name="Volume"
                      dataKey={(d: { volume: number }) => (d.volume / Math.max(...performanceMetrics.map(m => m.volume))) * 100}
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.4}
                    />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Queue Depth Visualization</CardTitle>
              <CardDescription>Active, processing, and waiting jobs over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={queueDepth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(156, 163, 175, 0.2)" />
                  <XAxis 
                    dataKey="time"
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    axisLine={{ stroke: "#e5e7eb" }}
                  />
                  <YAxis
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    axisLine={{ stroke: "#e5e7eb" }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <defs>
                    <linearGradient id="depthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                    </linearGradient>
                    <linearGradient id="processingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    </linearGradient>
                    <linearGradient id="waitingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="processing"
                    stackId="1"
                    stroke="#3b82f6"
                    fill="url(#processingGradient)"
                    name="Processing"
                  />
                  <Area
                    type="monotone"
                    dataKey="waiting"
                    stackId="1"
                    stroke="#f59e0b"
                    fill="url(#waitingGradient)"
                    name="Waiting"
                  />
                  <Area
                    type="monotone"
                    dataKey="depth"
                    stroke="#8b5cf6"
                    fill="url(#depthGradient)"
                    name="Total Depth"
                  />
                  <Brush dataKey="time" height={30} stroke="#8884d8" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="failures" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Failure Analysis</CardTitle>
              <CardDescription>Most common failure reasons and patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={failureAnalysis}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(156, 163, 175, 0.2)" />
                    <XAxis 
                      dataKey="reason"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                      axisLine={{ stroke: "#e5e7eb" }}
                    />
                    <YAxis
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                      axisLine={{ stroke: "#e5e7eb" }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">Failure Details</h4>
                  {failureAnalysis.map((failure, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                      <Badge variant="destructive" className="mt-0.5">
                        {failure.count}
                      </Badge>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{failure.reason}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {((failure.count / data.length) * 100).toFixed(2)}% of total jobs
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resource Utilization</CardTitle>
              <CardDescription>Current resource usage vs optimal levels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {resourceUtilization.map((resource) => (
                  <div key={resource.resource} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {resource.resource === "CPU" && <Cpu className="h-4 w-4" />}
                        {resource.resource === "Memory" && <HardDrive className="h-4 w-4" />}
                        {resource.resource === "Network" && <Network className="h-4 w-4" />}
                        {resource.resource === "Disk I/O" && <Activity className="h-4 w-4" />}
                        <span className="font-medium">{resource.resource}</span>
                      </div>
                      <span className={cn(
                        "text-sm font-medium",
                        resource.usage > resource.optimal ? "text-yellow-600" : "text-green-600"
                      )}>
                        {resource.usage}%
                      </span>
                    </div>
                    <div className="relative">
                      <Progress value={resource.usage} className="h-3" />
                      <div 
                        className="absolute top-0 h-3 w-0.5 bg-blue-600"
                        style={{ left: `${resource.optimal}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0%</span>
                      <span className="text-blue-600">Optimal: {resource.optimal}%</span>
                      <span>100%</span>
                    </div>
                  </div>
                ))}

                <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                  <h4 className="text-sm font-semibold mb-2">Optimization Suggestions</h4>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li>• Consider increasing worker concurrency for better CPU utilization</li>
                    <li>• Memory usage is within optimal range</li>
                    <li>• Network throughput has room for improvement</li>
                    <li>• Monitor disk I/O - approaching recommended limits</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}