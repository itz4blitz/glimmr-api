import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Activity,
  User,
  Settings,
  Shield,
  Key,
  Mail,
  Upload,
  Download,
  Trash2,
  Edit,
  Eye,
  Clock,
  ChevronDown,
  ChevronRight,
  RefreshCw
} from 'lucide-react'
import { useUserManagementStore } from '@/stores/userManagement'
import { formatDistanceToNow, format } from 'date-fns'
import type { UserActivityLog as ActivityLogType } from '@/types/userManagement'

interface UserActivityLogProps {
  userId: string
}

const activityIcons: Record<string, any> = {
  login: User,
  logout: User,
  profile_update: Edit,
  profile_view: Eye,
  preferences_update: Settings,
  user_update: Edit,
  user_create: User,
  user_delete: Trash2,
  role_change: Shield,
  password_reset: Key,
  email_verification: Mail,
  file_upload: Upload,
  file_download: Download,
  file_delete: Trash2,
  avatar_upload: Upload,
  api_key_generate: Key,
  api_key_revoke: Key,
  default: Activity
}

const activityColors: Record<string, string> = {
  login: 'text-green-600',
  logout: 'text-gray-600',
  profile_update: 'text-blue-600',
  profile_view: 'text-gray-600',
  preferences_update: 'text-blue-600',
  user_update: 'text-blue-600',
  user_create: 'text-green-600',
  user_delete: 'text-red-600',
  role_change: 'text-orange-600',
  password_reset: 'text-yellow-600',
  email_verification: 'text-green-600',
  file_upload: 'text-blue-600',
  file_download: 'text-gray-600',
  file_delete: 'text-red-600',
  avatar_upload: 'text-blue-600',
  api_key_generate: 'text-green-600',
  api_key_revoke: 'text-red-600',
  default: 'text-gray-600'
}

function ActivityItem({ activity }: { activity: ActivityLogType }) {
  const [expanded, setExpanded] = useState(false)
  
  const IconComponent = activityIcons[activity.action] || activityIcons.default
  const iconColor = activityColors[activity.action] || activityColors.default
  
  const formatActionText = (action: string) => {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const hasMetadata = activity.metadata && Object.keys(activity.metadata).length > 0

  return (
    <div className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className={`flex-shrink-0 ${iconColor}`}>
        <IconComponent className="h-5 w-5" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">{formatActionText(activity.action)}</span>
            <Badge variant="outline" className="text-xs">
              {activity.resourceType}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span title={format(new Date(activity.timestamp), 'PPpp')}>
              {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
            </span>
          </div>
        </div>
        
        {activity.resourceId && (
          <p className="text-sm text-muted-foreground mt-1">
            Resource ID: <code className="text-xs bg-muted px-1 rounded">{activity.resourceId}</code>
          </p>
        )}
        
        {hasMetadata && (
          <div className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3 mr-1" />
              ) : (
                <ChevronRight className="h-3 w-3 mr-1" />
              )}
              {expanded ? 'Hide' : 'Show'} details
            </Button>
            
            {expanded && (
              <div className="mt-2 p-2 bg-muted rounded text-xs">
                <pre className="whitespace-pre-wrap font-mono">
                  {JSON.stringify(activity.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
        
        {activity.ipAddress && (
          <p className="text-xs text-muted-foreground mt-1">
            IP: {activity.ipAddress}
          </p>
        )}
      </div>
    </div>
  )
}

export function UserActivityLog({ userId }: UserActivityLogProps) {
  const [page, setPage] = useState(1)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  
  const { userActivity, loadUserActivity } = useUserManagementStore()

  useEffect(() => {
    loadUserActivity(userId, 1)
  }, [userId, loadUserActivity])

  const handleLoadMore = async () => {
    setIsLoadingMore(true)
    try {
      await loadUserActivity(userId, page + 1)
      setPage(prev => prev + 1)
    } catch (error) {
      console.error('Failed to load more activity:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const handleRefresh = () => {
    setPage(1)
    loadUserActivity(userId, 1)
  }

  const groupActivitiesByDate = (activities: ActivityLogType[]) => {
    const groups: Record<string, ActivityLogType[]> = {}
    
    activities.forEach(activity => {
      const date = format(new Date(activity.timestamp), 'yyyy-MM-dd')
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(activity)
    })
    
    return groups
  }

  const activityGroups = groupActivitiesByDate(userActivity)
  const sortedDates = Object.keys(activityGroups).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Activity Log</h3>
          <p className="text-sm text-muted-foreground">
            Track user actions and system events
          </p>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Activity List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>
            {userActivity.length > 0 
              ? `Showing ${userActivity.length} activities`
              : 'No activity found'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userActivity.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Activity</h3>
              <p className="text-muted-foreground">
                This user hasn't performed any tracked actions yet.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-6">
                {sortedDates.map(date => (
                  <div key={date}>
                    <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2 mb-3">
                      <h4 className="text-sm font-semibold text-muted-foreground">
                        {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                      </h4>
                    </div>
                    
                    <div className="space-y-2">
                      {activityGroups[date].map(activity => (
                        <ActivityItem key={activity.id} activity={activity} />
                      ))}
                    </div>
                  </div>
                ))}
                
                {/* Load More Button */}
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Activity Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Summary</CardTitle>
          <CardDescription>
            Overview of user activity patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {userActivity.filter(a => a.action === 'login').length}
              </div>
              <div className="text-sm text-muted-foreground">Logins</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {userActivity.filter(a => a.action.includes('update')).length}
              </div>
              <div className="text-sm text-muted-foreground">Updates</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {userActivity.filter(a => a.action.includes('file')).length}
              </div>
              <div className="text-sm text-muted-foreground">File Actions</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {userActivity.filter(a => a.action.includes('api')).length}
              </div>
              <div className="text-sm text-muted-foreground">API Actions</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
