import { Button } from '@/components/ui/button'
import { Database, FileText } from 'lucide-react'

interface DashboardHeaderProps {
  onViewAllLogs: () => void
}

export function DashboardHeader({ onViewAllLogs }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
          <Database className="h-8 w-8 text-primary" />
          Queue Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Real-time monitoring and management of background job queues
        </p>
      </div>
      <div className="mt-4 sm:mt-0">
        <Button
          variant="outline"
          onClick={onViewAllLogs}
          className="flex items-center gap-2"
        >
          <FileText className="h-4 w-4" />
          View All Logs
        </Button>
      </div>
    </div>
  )
}
