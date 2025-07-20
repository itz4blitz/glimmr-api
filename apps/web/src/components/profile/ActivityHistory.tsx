import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Activity, 
  Search, 
  Filter, 
  Calendar, 
  MapPin, 
  Monitor, 
  Smartphone,
  Globe,
  Shield,
  User,
  Settings,

  Upload,
  Download,
  Trash2,
  Edit,
  Eye,
  RefreshCw
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ActivityLog {
  id: string
  action: string
  resourceType: string
  resourceId?: string
  timestamp: Date
  ipAddress: string
  userAgent: string
  location: string
  success: boolean
  metadata?: any
}

// Mock activity data
const mockActivities: ActivityLog[] = [
  {
    id: '1',
    action: 'login',
    resourceType: 'auth',
    timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    ipAddress: '192.168.1.100',
    userAgent: 'Chrome 120.0.0.0',
    location: 'New York, NY',
    success: true,
  },
  {
    id: '2',
    action: 'profile_update',
    resourceType: 'profile',
    resourceId: 'profile-123',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    ipAddress: '192.168.1.100',
    userAgent: 'Chrome 120.0.0.0',
    location: 'New York, NY',
    success: true,
    metadata: { updatedFields: ['firstName', 'lastName', 'bio'] },
  },
  {
    id: '3',
    action: 'avatar_upload',
    resourceType: 'file',
    resourceId: 'file-456',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    ipAddress: '192.168.1.100',
    userAgent: 'Chrome 120.0.0.0',
    location: 'New York, NY',
    success: true,
    metadata: { fileName: 'avatar.jpg', fileSize: 245760 },
  },
  {
    id: '4',
    action: 'preferences_update',
    resourceType: 'preferences',
    resourceId: 'pref-789',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    ipAddress: '192.168.1.100',
    userAgent: 'Chrome 120.0.0.0',
    location: 'New York, NY',
    success: true,
    metadata: { updatedFields: ['themePreference', 'notificationEmail'] },
  },
  {
    id: '5',
    action: 'login_failed',
    resourceType: 'auth',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    ipAddress: '203.0.113.1',
    userAgent: 'Firefox 119.0',
    location: 'Unknown',
    success: false,
    metadata: { reason: 'invalid_password' },
  },
]

const getActivityIcon = (action: string) => {
  if (action.includes('login')) return <Shield className="h-4 w-4" />
  if (action.includes('profile')) return <User className="h-4 w-4" />
  if (action.includes('preferences')) return <Settings className="h-4 w-4" />
  if (action.includes('upload')) return <Upload className="h-4 w-4" />
  if (action.includes('download')) return <Download className="h-4 w-4" />
  if (action.includes('delete')) return <Trash2 className="h-4 w-4" />
  if (action.includes('update')) return <Edit className="h-4 w-4" />
  if (action.includes('view')) return <Eye className="h-4 w-4" />
  return <Activity className="h-4 w-4" />
}

const getActivityDescription = (activity: ActivityLog) => {
  switch (activity.action) {
    case 'login':
      return 'Signed in to account'
    case 'login_failed':
      return 'Failed sign-in attempt'
    case 'logout':
      return 'Signed out of account'
    case 'profile_update':
      return `Updated profile${activity.metadata?.updatedFields ? ` (${activity.metadata.updatedFields.join(', ')})` : ''}`
    case 'avatar_upload':
      return `Uploaded new avatar${activity.metadata?.fileName ? ` (${activity.metadata.fileName})` : ''}`
    case 'avatar_remove':
      return 'Removed avatar'
    case 'preferences_update':
      return `Updated preferences${activity.metadata?.updatedFields ? ` (${activity.metadata.updatedFields.join(', ')})` : ''}`
    case 'password_change':
      return 'Changed password'
    case 'file_upload':
      return `Uploaded file${activity.metadata?.fileName ? ` (${activity.metadata.fileName})` : ''}`
    case 'file_delete':
      return 'Deleted file'
    default:
      return activity.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }
}

const getDeviceIcon = (userAgent: string) => {
  if (userAgent.toLowerCase().includes('mobile') || userAgent.toLowerCase().includes('iphone') || userAgent.toLowerCase().includes('android')) {
    return <Smartphone className="h-4 w-4" />
  }
  return <Monitor className="h-4 w-4" />
}

export function ActivityHistory() {
  const [activities] = useState<ActivityLog[]>(mockActivities)
  const [filteredActivities, setFilteredActivities] = useState<ActivityLog[]>(mockActivities)
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(false)

  // Filter activities based on search term and action filter
  useEffect(() => {
    let filtered = activities

    if (searchTerm) {
      filtered = filtered.filter(activity =>
        getActivityDescription(activity).toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.ipAddress.includes(searchTerm)
      )
    }

    if (actionFilter !== 'all') {
      filtered = filtered.filter(activity => activity.action.includes(actionFilter))
    }

    setFilteredActivities(filtered)
  }, [activities, searchTerm, actionFilter])

  const refreshActivities = async () => {
    setIsLoading(true)
    try {
      // Here you would call your API to fetch fresh activity data
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      // setActivities(newActivities)
    } catch (error) {
      console.error('Failed to refresh activities:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const uniqueActions = Array.from(new Set(activities.map(a => a.action.split('_')[0])))

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search activities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 input-enhanced"
          />
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="flex-1 sm:w-[180px] select-enhanced">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent className="select-content-enhanced">
              <SelectItem value="all">All Actions</SelectItem>
              {uniqueActions.map((action) => (
                <SelectItem key={action} value={action}>
                  {action.charAt(0).toUpperCase() + action.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={refreshActivities} disabled={isLoading} size="sm" className="px-3 button-enhanced">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''} sm:mr-2`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Activity List */}
      <div className="space-y-4">
        {filteredActivities.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No activities found</h3>
              <p className="text-muted-foreground text-center">
                {searchTerm || actionFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Your activity history will appear here.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredActivities.map((activity) => (
            <Card key={activity.id}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-3 sm:gap-4">
                  {/* Icon */}
                  <div className={`p-2 rounded-full flex-shrink-0 ${
                    activity.success
                      ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                      : 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                  }`}>
                    {getActivityIcon(activity.action)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                      <h4 className="text-sm font-medium break-words">
                        {getActivityDescription(activity)}
                      </h4>
                      <Badge variant={activity.success ? 'default' : 'destructive'} className="self-start sm:self-auto">
                        {activity.success ? 'Success' : 'Failed'}
                      </Badge>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{formatDistanceToNow(activity.timestamp, { addSuffix: true })}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {getDeviceIcon(activity.userAgent)}
                        <span className="truncate">{activity.userAgent}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{activity.location}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{activity.ipAddress}</span>
                      </div>
                    </div>

                    {/* Additional metadata */}
                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                        <strong>Details:</strong>
                        <pre className="mt-1 whitespace-pre-wrap break-words">
                          {JSON.stringify(activity.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Load More */}
      {filteredActivities.length > 0 && (
        <div className="text-center">
          <Button variant="outline" disabled>
            Load More Activities
            <span className="ml-2 text-xs text-muted-foreground">(Coming Soon)</span>
          </Button>
        </div>
      )}
    </div>
  )
}
