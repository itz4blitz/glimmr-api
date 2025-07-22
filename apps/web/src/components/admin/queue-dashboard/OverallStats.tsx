import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { BarChart3, Zap, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'

interface OverallStats {
  totalJobs: number
  activeJobs: number
  completedJobs: number
  failedJobs: number
  successRate: number
  totalQueues: number
  healthyQueues: number
}

interface OverallStatsProps {
  stats: OverallStats
}

export function OverallStats({ stats }: OverallStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Jobs</p>
                <p className="text-2xl font-bold">{stats.totalJobs.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Across {stats.totalQueues} queues</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active Jobs</p>
                <p className="text-2xl font-bold text-orange-600">{stats.activeJobs}</p>
                <p className="text-xs text-muted-foreground mt-1">Currently processing</p>
              </div>
              <Zap className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Success Rate</p>
                <p className="text-2xl font-bold text-green-600">{stats.successRate}%</p>
                <p className="text-xs text-muted-foreground mt-1">Last 24 hours</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Failed Jobs</p>
                <p className="text-2xl font-bold text-red-600">{stats.failedJobs}</p>
                <p className="text-xs text-muted-foreground mt-1">Require attention</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Healthy Queues</p>
                <p className="text-2xl font-bold text-purple-600">{stats.healthyQueues}/{stats.totalQueues}</p>
                <p className="text-xs text-muted-foreground mt-1">System status</p>
              </div>
              <CheckCircle className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
