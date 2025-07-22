import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { 
  AlertCircle, 
  CheckCircle, 
  Info, 
  AlertTriangle, 
  X,
  Bell,
  BellOff
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import apiClient from '@/lib/api'
import { toast } from 'sonner'

interface Notification {
  id: string
  type: 'job_success' | 'job_failure' | 'job_warning' | 'system_alert' | 'user_action' | 'info'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  title: string
  message: string
  read: boolean
  createdAt: string
  jobId?: string
  data?: any
}

interface NotificationListProps {
  onNotificationRead?: () => void
  onClose?: () => void
}

export function NotificationList({ onNotificationRead, onClose }: NotificationListProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/notifications?limit=20')
      setNotifications(response.data)
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
      toast.error('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  const markAsRead = async (id: string) => {
    try {
      await apiClient.put(`/notifications/${id}/read`, {})
      
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      )
      
      onNotificationRead?.()
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await apiClient.put('/notifications/mark-all-read', {})
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      onNotificationRead?.()
      toast.success('All notifications marked as read')
    } catch (error) {
      console.error('Failed to mark all as read:', error)
      toast.error('Failed to mark notifications as read')
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      await apiClient.delete(`/notifications/${id}`)
      
      setNotifications(prev => prev.filter(n => n.id !== id))
      toast.success('Notification deleted')
    } catch (error) {
      console.error('Failed to delete notification:', error)
      toast.error('Failed to delete notification')
    }
  }

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'job_success':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'job_failure':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'job_warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'system_alert':
        return <AlertCircle className="h-5 w-5 text-blue-500" />
      case 'info':
      default:
        return <Info className="h-5 w-5 text-gray-500" />
    }
  }

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'border-red-500 bg-red-50 dark:bg-red-950'
      case 'high':
        return 'border-orange-500 bg-orange-50 dark:bg-orange-950'
      case 'medium':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'
      default:
        return 'border-gray-200 dark:border-gray-800'
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="flex flex-col h-[500px]">
      <div className="flex items-center justify-between p-4">
        <h3 className="text-lg font-semibold">Notifications</h3>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs"
            >
              Mark all read
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      <Separator />
      
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <BellOff className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">No notifications</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "p-4 hover:bg-muted/50 transition-colors",
                  !notification.read && "bg-muted/20",
                  getPriorityColor(notification.priority),
                  "border-l-4"
                )}
              >
                <div className="flex gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className={cn(
                          "text-sm font-medium",
                          !notification.read && "font-semibold"
                        )}>
                          {notification.title}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(notification.createdAt), 'MMM d, h:mm a')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsRead(notification.id)}
                            className="h-8 px-2 text-xs"
                          >
                            Mark read
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteNotification(notification.id)}
                          className="h-8 w-8"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}