import { useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ErrorBoundary() {
  const error = useRouteError()

  let errorMessage: string
  let errorStatus: string | number = 'Error'

  if (isRouteErrorResponse(error)) {
    errorMessage = error.data?.message || error.statusText || 'Something went wrong'
    errorStatus = error.status
  } else if (error instanceof Error) {
    errorMessage = error.message
  } else if (typeof error === 'string') {
    errorMessage = error
  } else {
    errorMessage = 'An unexpected error occurred'
  }

  const handleRefresh = () => {
    window.location.reload()
  }

  const handleGoHome = () => {
    window.location.href = '/dashboard'
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-card-elevated">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-xl font-semibold">
            {errorStatus === 404 ? 'Page Not Found' : 'Something went wrong'}
          </CardTitle>
          <CardDescription>
            {errorStatus === 404 
              ? "The page you're looking for doesn't exist."
              : errorMessage
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button 
            onClick={handleRefresh} 
            className="w-full button-enhanced"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <Button 
            onClick={handleGoHome} 
            className="w-full button-primary-enhanced"
          >
            <Home className="h-4 w-4 mr-2" />
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
