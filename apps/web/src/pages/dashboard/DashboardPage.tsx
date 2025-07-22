import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  User, Settings, Shield, TrendingUp, FileText, Activity, Users, 
  Building2, DollarSign, Database, Play, RefreshCw, Clock
} from 'lucide-react'
import { getRoleDisplayName, isAdmin } from '@/lib/permissions'
import { AppLayout } from '@/components/layout/AppLayout'
import { apiClient } from '@/lib/api'
import { toast } from 'sonner'

interface DashboardStats {
  hospitals: {
    total: number
    active: number
    withPrices: number
  }
  prices: {
    total: number
    lastUpdated: string | null
  }
  jobs: {
    totalProcessed: number
    activeJobs: number
    failedJobs: number
    successRate: number
  }
  files: {
    totalFiles: number
    totalSize: number
    pendingDownloads: number
  }
}

export function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRunningJob, setIsRunningJob] = useState<string | null>(null)

  const fetchDashboardStats = async () => {
    try {
      const response = await apiClient.get('/dashboard/stats')
      setStats(response.data)
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
      // Set default values if the endpoint doesn't exist yet
      setStats({
        hospitals: { total: 0, active: 0, withPrices: 0 },
        prices: { total: 0, lastUpdated: null },
        jobs: { totalProcessed: 0, activeJobs: 0, failedJobs: 0, successRate: 0 },
        files: { totalFiles: 0, totalSize: 0, pendingDownloads: 0 }
      })
    } finally {
      setIsLoading(false)
    }
  }

  const runManualJob = async (jobType: string) => {
    setIsRunningJob(jobType)
    try {
      let endpoint = ''
      let data = {}
      
      switch (jobType) {
        case 'pra-scan':
          endpoint = '/jobs/pra/scan'
          data = { testMode: true } // Limit to 3 states for testing
          break
        case 'analytics':
          endpoint = '/jobs/analytics/refresh'
          break
        case 'export':
          endpoint = '/jobs/export'
          data = { 
            format: 'json', 
            dataset: 'hospitals',
            limit: 100 
          }
          break
        default:
          throw new Error('Unknown job type')
      }

      const response = await apiClient.post(endpoint, data)
      toast.success(`Job started successfully! Job ID: ${response.data.jobId || response.data.id}`)
      
      // Refresh stats after a delay
      setTimeout(() => {
        fetchDashboardStats()
      }, 2000)
    } catch (error: any) {
      console.error('Failed to run job:', error)
      toast.error(`Failed to start job: ${error?.response?.data?.message || error?.message || 'Unknown error'}`)
    } finally {
      setIsRunningJob(null)
    }
  }

  useEffect(() => {
    fetchDashboardStats()
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchDashboardStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    
    if (diffMs < 60000) return 'Just now'
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`
    return `${Math.floor(diffMs / 86400000)}d ago`
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {user?.email}!
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Hospitals</p>
                    <p className="text-2xl font-bold">
                      {isLoading ? '-' : stats?.hospitals.total.toLocaleString() || '0'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats?.hospitals.active || 0} active
                    </p>
                  </div>
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Price Records</p>
                    <p className="text-2xl font-bold">
                      {isLoading ? '-' : stats?.prices.total.toLocaleString() || '0'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Updated {formatTimeAgo(stats?.prices.lastUpdated || null)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          >
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Job Success Rate</p>
                    <p className="text-2xl font-bold text-green-600">
                      {isLoading ? '-' : `${Math.round(stats?.jobs.successRate || 0)}%`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats?.jobs.activeJobs || 0} active, {stats?.jobs.failedJobs || 0} failed
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.3 }}
          >
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Data Files</p>
                    <p className="text-2xl font-bold">
                      {isLoading ? '-' : stats?.files.totalFiles.toLocaleString() || '0'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatFileSize(stats?.files.totalSize || 0)}
                    </p>
                  </div>
                  <Database className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* User Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            className="lg:col-span-2"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  User Information
                </CardTitle>
                <CardDescription>
                  Your account details and role information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p className="text-foreground break-all">{user?.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">User ID</label>
                    <p className="text-foreground font-mono text-sm">{user?.id}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Role</label>
                    <div className="flex items-center gap-2">
                      <Badge variant={user?.role === 'super_admin' ? 'default' : user?.role === 'admin' ? 'secondary' : 'outline'}>
                        <Shield className="h-3 w-3 mr-1" />
                        {user?.role ? getRoleDisplayName(user.role) : 'Unknown'}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <Badge variant={user?.isActive ? 'default' : 'destructive'}>
                      {user?.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Manual Job Triggers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Manual Jobs
                </CardTitle>
                <CardDescription>
                  Trigger background jobs manually
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => runManualJob('pra-scan')}
                  disabled={isRunningJob === 'pra-scan'}
                >
                  {isRunningJob === 'pra-scan' ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Activity className="h-4 w-4 mr-2" />
                  )}
                  PRA Hospital Scan (Test Mode)
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => runManualJob('analytics')}
                  disabled={isRunningJob === 'analytics'}
                >
                  {isRunningJob === 'analytics' ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <TrendingUp className="h-4 w-4 mr-2" />
                  )}
                  Refresh Analytics
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => runManualJob('export')}
                  disabled={isRunningJob === 'export'}
                >
                  {isRunningJob === 'export' ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Export Hospital Data
                </Button>

                <div className="pt-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 inline mr-1" />
                  Jobs run in the background. Check the queue dashboard for progress.
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>
                Common tasks and navigation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <Button
                  variant="outline"
                  className="h-16 sm:h-20 flex-col justify-center"
                  onClick={() => navigate('/profile')}
                >
                  <User className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                  <span className="text-xs sm:text-sm">Profile Settings</span>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-16 sm:h-20 flex-col justify-center"
                  onClick={() => navigate('/hospitals')}
                >
                  <Building2 className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                  <span className="text-xs sm:text-sm">Browse Hospitals</span>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-16 sm:h-20 flex-col justify-center"
                  onClick={() => navigate('/prices')}
                >
                  <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                  <span className="text-xs sm:text-sm">Price Data</span>
                </Button>

                {user && isAdmin(user.role) && (
                  <>
                    <Button
                      variant="outline"
                      className="h-16 sm:h-20 flex-col justify-center"
                      onClick={() => navigate('/admin/users')}
                    >
                      <Users className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                      <span className="text-xs sm:text-sm">User Management</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-16 sm:h-20 flex-col justify-center"
                      onClick={() => navigate('/admin/queues')}
                    >
                      <Activity className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                      <span className="text-xs sm:text-sm">Queue Dashboard</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-16 sm:h-20 flex-col justify-center"
                      onClick={() => navigate('/admin/settings')}
                    >
                      <Settings className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                      <span className="text-xs sm:text-sm">Admin Panel</span>
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Welcome Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.3 }}
          className="mt-6 sm:mt-8"
        >
          <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
            <CardContent className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-2">Welcome to Glimmr!</h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Your healthcare price transparency platform is ready to use.
                {stats && stats.hospitals.total === 0 && (
                  <span className="block mt-2 font-medium">
                    Get started by running a PRA Hospital Scan to import hospital data.
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  )
}