import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api'
import { DashboardHeader } from './DashboardHeader'
import { OverallStats } from './OverallStats'
import { QueueGrid } from './QueueGrid'
import { LoadingState } from './LoadingState'
import { ErrorState } from './ErrorState'

interface QueueStats {
  name: string
  displayName: string
  waiting: number
  active: number
  completed: number
  failed: number
  paused?: boolean
  error?: string
  processingRate?: number
  avgProcessingTime?: number
  lastProcessed?: string
}

interface OverallStatsData {
  totalJobs: number
  activeJobs: number
  completedJobs: number
  failedJobs: number
  successRate: number
  totalQueues: number
  healthyQueues: number
}

interface QueueStatsResponse {
  queues: QueueStats[]
  overall: OverallStatsData
  timestamp: string
}

interface QueueDashboardProps {
  onViewLogs: (queueName: string, displayName: string) => void
  onViewAllLogs: () => void
  onConfigure: (queueName: string) => void
  onTriggerJob?: (queueName: string) => void
}

export function QueueDashboard({ onViewLogs, onViewAllLogs, onConfigure, onTriggerJob }: QueueDashboardProps) {
  const [queueStats, setQueueStats] = useState<QueueStatsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const getQueueDisplayName = (queueName: string): string => {
    const displayNames: Record<string, string> = {
      'price-file-parser': 'Price File Parser',
      'price-update': 'Price Normalization',
      'analytics-refresh': 'Analytics Refresh',
      'export-data': 'Data Export',
      'pra-unified-scan': 'Hospital Discovery (PRA)',
      'pra-file-download': 'File Downloads (PRA)'
    }
    return displayNames[queueName] || queueName
  }

  const fetchQueueStats = async () => {
    try {
      console.log('Fetching queue stats from:', apiClient.defaults.baseURL + '/jobs/stats')
      
      // Fetch both stats and configurations with schedules
      const [statsResponse, configsResponse] = await Promise.all([
        apiClient.get('/jobs/stats'),
        apiClient.get('/jobs/configurations/with-schedules')
      ])
      
      console.log('Real queue stats response:', statsResponse.data)
      console.log('Queue configs with schedules:', configsResponse.data)

      // Create a map of queue configs for easy lookup
      const configMap = new Map(
        configsResponse.data.map((config: any) => [config.queueName, config])
      )

      // Transform API response to include display names, schedule info, and additional data
      const transformedData = {
        ...statsResponse.data,
        queues: statsResponse.data.queues?.map((queue: any) => {
          const config = configMap.get(queue.name) || {}
          return {
            ...queue,
            displayName: getQueueDisplayName(queue.name),
            // Use real data from API
            processingRate: queue.processingRate || 0,
            avgProcessingTime: queue.avgProcessingTime || 0,
            lastProcessed: queue.lastProcessed || null,
            // Add configuration and schedule information
            config: {
              ...config,
              schedules: config?.schedules || 0,
              activeSchedules: config?.activeSchedules || 0,
              nextScheduledRun: config?.nextScheduledRun || null,
            }
          }
        }) || []
      }

      console.log('Transformed data being set:', transformedData)
      console.log('First queue in transformed data:', transformedData.queues[0])
      setQueueStats(transformedData)
    } catch (error: any) {
      console.error('Failed to fetch queue stats:', error)
      console.error('Error details:', {
        message: error?.message,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        url: error?.config?.url
      })

      // Handle authentication errors specifically
      if (error?.response?.status === 401) {
        toast.error('Your session has expired. Please log in again.')
        // The interceptor should handle the redirect to login
      } else {
        // Clear any existing data and show error
        setQueueStats(null)
        toast.error(`Failed to connect to queue API: ${error?.response?.data?.message || error?.message || 'Unknown error'}`)
      }
    }
  }

  const pauseQueue = async (queueName: string) => {
    try {
      await apiClient.post(`/jobs/queue/${queueName}/pause`)
      toast.success(`Queue ${queueName} paused`)
      // Real-time update will handle the refresh
    } catch (error: any) {
      toast.error(`Failed to pause queue: ${error?.response?.data?.message || error?.message || 'Unknown error'}`)
    }
  }

  const resumeQueue = async (queueName: string) => {
    try {
      await apiClient.post(`/jobs/queue/${queueName}/resume`)
      toast.success(`Queue ${queueName} resumed`)
      // Real-time update will handle the refresh
    } catch (error: any) {
      toast.error(`Failed to resume queue: ${error?.response?.data?.message || error?.message || 'Unknown error'}`)
    }
  }

  const retryFailedJobs = async (queueName: string) => {
    try {
      await apiClient.post(`/jobs/queue/${queueName}/retry-failed`)
      toast.success(`Retrying failed jobs in ${queueName}`)
      // Real-time update will handle the refresh
    } catch (error: any) {
      toast.error(`Failed to retry jobs: ${error?.response?.data?.message || error?.message || 'Unknown error'}`)
    }
  }

  const drainQueue = async (queueName: string) => {
    try {
      await apiClient.post(`/jobs/queue/${queueName}/drain`)
      toast.success(`Queue ${queueName} drained`)
      // Real-time update will handle the refresh
    } catch (error: any) {
      toast.error(`Failed to drain queue: ${error?.response?.data?.message || error?.message || 'Unknown error'}`)
    }
  }

  const fetchData = async () => {
    setIsLoading(true)
    await fetchQueueStats()
    setIsLoading(false)
  }

  useEffect(() => {
    fetchData()

    // Real-time updates every 5 seconds
    const interval = setInterval(fetchQueueStats, 5000)
    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return <LoadingState />
  }

  if (!queueStats) {
    return <ErrorState onRetry={fetchData} />
  }

  return (
    <div className="space-y-6">
      <DashboardHeader onViewAllLogs={onViewAllLogs} />
      
      <OverallStats stats={queueStats.overall} />
      
      <QueueGrid
        queues={queueStats.queues}
        onViewLogs={onViewLogs}
        onPause={pauseQueue}
        onResume={resumeQueue}
        onRetryFailed={retryFailedJobs}
        onDrain={drainQueue}
        onConfigure={onConfigure}
        onTriggerJob={onTriggerJob}
      />
    </div>
  )
}
