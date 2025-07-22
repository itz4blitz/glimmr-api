import React, { useState, useMemo } from 'react'
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
  LineChart,
  Line,
  ComposedChart,
  ReferenceLine,
} from 'recharts'
import { format, subHours, startOfHour, parseISO, isWithinInterval } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Clock, TrendingUp, Activity, BarChart3, Timer } from 'lucide-react'

interface JobLog {
  id: string
  jobId: string
  level: 'info' | 'warning' | 'error' | 'success'
  message: string
  createdAt: string
  context?: {
    jobName?: string
    duration?: number
    state?: string
  }
}

interface JobExecutionTimelineProps {
  logs: JobLog[]
  queueName?: string
}

type TimeRange = '1h' | '6h' | '12h' | '24h' | '7d'
type ChartType = 'timeline' | 'distribution' | 'performance' | 'states'

export function JobExecutionTimeline({ logs, queueName }: JobExecutionTimelineProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [chartType, setChartType] = useState<ChartType>('timeline')

  // Calculate time boundaries
  const now = new Date()
  const startTime = useMemo(() => {
    switch (timeRange) {
      case '1h': return subHours(now, 1)
      case '6h': return subHours(now, 6)
      case '12h': return subHours(now, 12)
      case '24h': return subHours(now, 24)
      case '7d': return subHours(now, 168)
      default: return subHours(now, 24)
    }
  }, [timeRange])

  // Filter logs by time range
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const logDate = parseISO(log.createdAt)
      return isWithinInterval(logDate, { start: startTime, end: now })
    })
  }, [logs, startTime, now])

  // Process data for timeline chart
  const timelineData = useMemo(() => {
    const hourlyBuckets = new Map<string, { 
      hour: string, 
      completed: number, 
      failed: number, 
      active: number,
      total: number 
    }>()

    // Initialize buckets
    const hours = timeRange === '7d' ? 168 : parseInt(timeRange)
    for (let i = 0; i < hours; i++) {
      const hour = startOfHour(subHours(now, i))
      const key = format(hour, 'yyyy-MM-dd HH:00')
      hourlyBuckets.set(key, {
        hour: key,
        completed: 0,
        failed: 0,
        active: 0,
        total: 0,
      })
    }

    // Count jobs by status
    filteredLogs.forEach(log => {
      const hour = format(startOfHour(parseISO(log.createdAt)), 'yyyy-MM-dd HH:00')
      const bucket = hourlyBuckets.get(hour)
      if (bucket) {
        bucket.total++
        if (log.level === 'success' && log.message.includes('completed')) {
          bucket.completed++
        } else if (log.level === 'error') {
          bucket.failed++
        } else if (log.message.includes('processing')) {
          bucket.active++
        }
      }
    })

    return Array.from(hourlyBuckets.values())
      .sort((a, b) => a.hour.localeCompare(b.hour))
      .map(item => ({
        ...item,
        hour: format(parseISO(item.hour), timeRange === '7d' ? 'MM/dd' : 'HH:mm'),
      }))
  }, [filteredLogs, timeRange])

  // Process data for job distribution
  const distributionData = useMemo(() => {
    const jobCounts = new Map<string, number>()
    
    filteredLogs.forEach(log => {
      const jobName = log.context?.jobName || 'Unknown'
      jobCounts.set(jobName, (jobCounts.get(jobName) || 0) + 1)
    })

    return Array.from(jobCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // Top 10 jobs
  }, [filteredLogs])

  // Process performance data
  const performanceData = useMemo(() => {
    const hourlyPerf = new Map<string, {
      hour: string,
      avgDuration: number,
      successRate: number,
      count: number,
    }>()

    filteredLogs.forEach(log => {
      if (log.context?.duration) {
        const hour = format(startOfHour(parseISO(log.createdAt)), 'yyyy-MM-dd HH:00')
        const existing = hourlyPerf.get(hour) || {
          hour,
          avgDuration: 0,
          successRate: 0,
          count: 0,
        }
        
        existing.avgDuration = ((existing.avgDuration * existing.count) + log.context.duration) / (existing.count + 1)
        existing.count++
        
        if (log.level === 'success') {
          existing.successRate = ((existing.successRate * (existing.count - 1)) + 100) / existing.count
        } else if (log.level === 'error') {
          existing.successRate = ((existing.successRate * (existing.count - 1)) + 0) / existing.count
        }
        
        hourlyPerf.set(hour, existing)
      }
    })

    return Array.from(hourlyPerf.values())
      .sort((a, b) => a.hour.localeCompare(b.hour))
      .map(item => ({
        ...item,
        hour: format(parseISO(item.hour), timeRange === '7d' ? 'MM/dd' : 'HH:mm'),
        avgDuration: Math.round(item.avgDuration / 1000), // Convert to seconds
      }))
  }, [filteredLogs, timeRange])

  // Process state-specific data (for PRA scans)
  const stateData = useMemo(() => {
    if (!queueName?.includes('pra')) return []
    
    const stateCounts = new Map<string, {
      state: string,
      hospitals: number,
      files: number,
      errors: number,
    }>()

    filteredLogs.forEach(log => {
      if (log.context?.state && log.message.includes('Completed')) {
        const state = log.context.state
        const existing = stateCounts.get(state) || {
          state,
          hospitals: 0,
          files: 0,
          errors: 0,
        }
        
        // Parse numbers from message
        const hospitalMatch = log.message.match(/(\d+) new hospitals/)
        const fileMatch = log.message.match(/(\d+) new files/)
        
        if (hospitalMatch) existing.hospitals += parseInt(hospitalMatch[1])
        if (fileMatch) existing.files += parseInt(fileMatch[1])
        if (log.level === 'error') existing.errors++
        
        stateCounts.set(state, existing)
      }
    })

    return Array.from(stateCounts.values())
      .sort((a, b) => b.hospitals - a.hospitals)
  }, [filteredLogs, queueName])

  // Calculate summary statistics
  const stats = useMemo(() => {
    const completed = filteredLogs.filter(l => l.level === 'success' && l.message.includes('completed')).length
    const failed = filteredLogs.filter(l => l.level === 'error').length
    const total = filteredLogs.length
    const successRate = total > 0 ? (completed / total * 100).toFixed(1) : '0'
    
    const durations = filteredLogs
      .filter(l => l.context?.duration)
      .map(l => l.context!.duration!)
    
    const avgDuration = durations.length > 0 
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000)
      : 0

    return { completed, failed, total, successRate, avgDuration }
  }, [filteredLogs])

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover p-3 rounded-lg shadow-lg border">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

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
            {/* Summary Stats */}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="h-6">
                  {stats.completed} Completed
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="h-6">
                  {stats.failed} Failed
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="h-6">
                  {stats.successRate}% Success
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Avg: {stats.avgDuration}s
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between">
            <Tabs value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
              <TabsList>
                <TabsTrigger value="timeline" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Timeline
                </TabsTrigger>
                <TabsTrigger value="distribution" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Distribution
                </TabsTrigger>
                <TabsTrigger value="performance" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Performance
                </TabsTrigger>
                {queueName?.includes('pra') && (
                  <TabsTrigger value="states">
                    States
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>

            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
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

          {/* Charts */}
          <div className="h-80">
            {chartType === 'timeline' && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData}>
                  <defs>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="hour" 
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    stackId="1"
                    stroke="#10b981"
                    fill="url(#colorCompleted)"
                    name="Completed"
                  />
                  <Area
                    type="monotone"
                    dataKey="active"
                    stackId="1"
                    stroke="#3b82f6"
                    fill="url(#colorActive)"
                    name="Active"
                  />
                  <Area
                    type="monotone"
                    dataKey="failed"
                    stackId="1"
                    stroke="#ef4444"
                    fill="url(#colorFailed)"
                    name="Failed"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {chartType === 'distribution' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" tick={{ fill: 'currentColor' }} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                    width={150}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {chartType === 'performance' && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="hour" 
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <YAxis 
                    yAxisId="left" 
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                    label={{ value: 'Duration (seconds)', angle: -90, position: 'insideLeft' }}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right"
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                    label={{ value: 'Success Rate (%)', angle: 90, position: 'insideRight' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    yAxisId="left" 
                    dataKey="avgDuration" 
                    fill="#8b5cf6" 
                    name="Avg Duration (s)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="successRate" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="Success Rate (%)"
                  />
                  <ReferenceLine 
                    y={95} 
                    yAxisId="right" 
                    stroke="#10b981" 
                    strokeDasharray="3 3" 
                    label="Target"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}

            {chartType === 'states' && stateData.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stateData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="state" 
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="hospitals" stackId="a" fill="#3b82f6" name="Hospitals" />
                  <Bar dataKey="files" stackId="a" fill="#10b981" name="Files" />
                  <Bar dataKey="errors" fill="#ef4444" name="Errors" />
                </BarChart>
              </ResponsiveContainer>
            )}

            {chartType === 'states' && stateData.length === 0 && (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No state data available for this time range
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}