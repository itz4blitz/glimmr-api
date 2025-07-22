import { Button } from '@/components/ui/button'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface ErrorStateProps {
  onRetry: () => void
}

export function ErrorState({ onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <AlertTriangle className="h-16 w-16 text-red-500 mb-4" />
      <h2 className="text-2xl font-bold text-foreground mb-2">Connection Failed</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        Unable to connect to the queue monitoring API. Please check your connection and try again.
      </p>
      <Button onClick={onRetry} className="flex items-center gap-2">
        <RotateCcw className="h-4 w-4" />
        Retry Connection
      </Button>
    </div>
  )
}
