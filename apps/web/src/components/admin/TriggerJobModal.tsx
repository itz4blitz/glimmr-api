import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Zap, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api'

interface TriggerJobModalProps {
  queueName: string | null
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

// Queue-specific job data templates
const getJobTemplate = (queueName: string): any => {
  switch (queueName) {
    case 'pra-unified-scan':
      return {
        testMode: true,
        states: ['CA', 'FL', 'TX'],
        forceRefresh: false
      }
    
    case 'pra-file-download':
      return {
        hospitalId: 'test-hospital-001',
        fileId: 'test-file-001',
        fileUrl: 'https://example.com/transparency-file.csv',
        filename: 'transparency-file.csv',
        filesuffix: 'csv',
        size: '1000000',
        retrieved: new Date().toISOString()
      }
    
    case 'price-file-parser':
      return {
        fileId: 'test-file-001',
        hospitalId: 'test-hospital-001',
        filePath: 'hospitals/test-hospital-001/transparency-file.csv',
        fileType: 'csv',
        fileSize: 1000000
      }
    
    case 'price-update':
      return {
        hospitalId: 'test-hospital-001',
        batchSize: 100,
        forceUpdate: false
      }
    
    case 'analytics-refresh':
      return {
        metricTypes: ['price-statistics', 'hospital-metrics'],
        forceRefresh: true,
        batchSize: 100
      }
    
    case 'export-data':
      return {
        format: 'json',
        dataset: 'hospitals',
        limit: 1000
      }
    
    default:
      return {}
  }
}

const getQueueDescription = (queueName: string): string => {
  const descriptions: Record<string, string> = {
    'price-file-parser': 'Parses CSV/JSON price files and extracts pricing data',
    'price-update': 'Normalizes and updates price data in the database',
    'analytics-refresh': 'Refreshes analytics and aggregated metrics',
    'export-data': 'Exports data to various formats',
    'pra-unified-scan': 'Scans Patient Rights Advocate API for hospital updates',
    'pra-file-download': 'Downloads files discovered by PRA scan'
  }
  return descriptions[queueName] || 'Process queue jobs'
}

export function TriggerJobModal({ queueName, isOpen, onClose, onSuccess }: TriggerJobModalProps) {
  const [jobData, setJobData] = useState<string>('')
  const [jobName, setJobName] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize job data when modal opens
  React.useEffect(() => {
    if (isOpen && queueName) {
      const template = getJobTemplate(queueName)
      setJobData(JSON.stringify(template, null, 2))
      setJobName(`manual-${queueName}-${Date.now()}`)
      setError(null)
    }
  }, [isOpen, queueName])

  const handleSubmit = async () => {
    if (!queueName) return

    setIsSubmitting(true)
    setError(null)

    try {
      // Parse and validate JSON
      let parsedData = {}
      if (jobData.trim()) {
        try {
          parsedData = JSON.parse(jobData)
        } catch (e) {
          setError('Invalid JSON format. Please check your job data.')
          setIsSubmitting(false)
          return
        }
      }

      // Make API call to trigger job
      const response = await apiClient.post(`/jobs/queue/${queueName}/add`, {
        name: jobName || `manual-${queueName}-${Date.now()}`,
        data: parsedData,
        opts: {
          priority: 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          }
        }
      })

      toast.success(`Job added to ${queueName} queue successfully`)
      onSuccess?.()
      onClose()
    } catch (error: any) {
      console.error('Failed to trigger job:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to trigger job'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setJobData('')
    setJobName('')
    setError(null)
    onClose()
  }

  if (!queueName) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Trigger Job: {queueName}
          </DialogTitle>
          <DialogDescription>
            {getQueueDescription(queueName)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="jobName">Job Name (optional)</Label>
            <Input
              id="jobName"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder={`manual-${queueName}-${Date.now()}`}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jobData">Job Data (JSON)</Label>
            <Textarea
              id="jobData"
              value={jobData}
              onChange={(e) => setJobData(e.target.value)}
              placeholder="Enter job data as JSON..."
              className="font-mono text-sm h-64"
            />
            <p className="text-xs text-muted-foreground">
              Enter the job data as valid JSON. A template has been provided based on the queue type.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Triggering...' : 'Trigger Job'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}