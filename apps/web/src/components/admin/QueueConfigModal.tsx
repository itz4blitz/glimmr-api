import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, RefreshCw } from 'lucide-react'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api'

interface QueueConfig {
  queueName: string
  displayName: string
  description: string | null
  isEnabled: boolean
  maxConcurrency: number
  defaultJobOptions: any
  removeOnComplete: number
  removeOnFail: number
  rateLimitMax: number | null
  rateLimitDuration: number | null
  alertOnFailureCount: number
  alertOnQueueSize: number
}

interface QueueConfigModalProps {
  isOpen: boolean
  onClose: () => void
  queueName: string | null
}

export function QueueConfigModal({ isOpen, onClose, queueName }: QueueConfigModalProps) {
  const [config, setConfig] = useState<QueueConfig | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen && queueName) {
      fetchConfig()
    }
  }, [isOpen, queueName])

  const fetchConfig = async () => {
    if (!queueName) return
    
    setIsLoading(true)
    try {
      const response = await apiClient.get(`/jobs/configuration/${queueName}`)
      setConfig(response.data)
    } catch (error: any) {
      console.error('Failed to fetch queue configuration:', error)
      toast.error('Failed to fetch queue configuration')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!config || !queueName) return
    
    setIsSaving(true)
    try {
      const response = await apiClient.put(`/jobs/configuration/${queueName}`, {
        displayName: config.displayName,
        description: config.description,
        isEnabled: config.isEnabled,
        maxConcurrency: config.maxConcurrency,
        removeOnComplete: config.removeOnComplete,
        removeOnFail: config.removeOnFail,
        rateLimitMax: config.rateLimitMax,
        rateLimitDuration: config.rateLimitDuration,
        alertOnFailureCount: config.alertOnFailureCount,
        alertOnQueueSize: config.alertOnQueueSize,
      })
      setConfig(response.data)
      toast.success('Queue configuration updated successfully')
    } catch (error: any) {
      console.error('Failed to save queue configuration:', error)
      toast.error('Failed to save queue configuration')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    await fetchConfig()
    toast.info('Configuration reset to current values')
  }

  if (!isOpen || !config) return null

  return (
    <AnimatePresence>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Queue Configuration: {config.displayName}
            </DialogTitle>
            <DialogDescription>
              Configure settings for the {config.queueName} queue
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto py-4">
              <TabsContent value="general" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={config.displayName}
                    onChange={(e) => setConfig({ ...config, displayName: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={config.description || ''}
                    onChange={(e) => setConfig({ ...config, description: e.target.value })}
                    placeholder="Optional description for this queue"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="isEnabled">Queue Enabled</Label>
                    <p className="text-sm text-muted-foreground">
                      When disabled, the queue will not process new jobs
                    </p>
                  </div>
                  <Switch
                    id="isEnabled"
                    checked={config.isEnabled}
                    onCheckedChange={(checked) => setConfig({ ...config, isEnabled: checked })}
                  />
                </div>
              </TabsContent>

              <TabsContent value="performance" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="maxConcurrency">Max Concurrency</Label>
                  <Input
                    id="maxConcurrency"
                    type="number"
                    min="1"
                    max="100"
                    value={config.maxConcurrency}
                    onChange={(e) => setConfig({ ...config, maxConcurrency: parseInt(e.target.value) || 1 })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Maximum number of jobs processed simultaneously
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="removeOnComplete">Keep Completed Jobs</Label>
                    <Input
                      id="removeOnComplete"
                      type="number"
                      min="0"
                      max="1000"
                      value={config.removeOnComplete}
                      onChange={(e) => setConfig({ ...config, removeOnComplete: parseInt(e.target.value) || 0 })}
                    />
                    <p className="text-sm text-muted-foreground">
                      Number of completed jobs to keep
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="removeOnFail">Keep Failed Jobs</Label>
                    <Input
                      id="removeOnFail"
                      type="number"
                      min="0"
                      max="1000"
                      value={config.removeOnFail}
                      onChange={(e) => setConfig({ ...config, removeOnFail: parseInt(e.target.value) || 0 })}
                    />
                    <p className="text-sm text-muted-foreground">
                      Number of failed jobs to keep
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Rate Limiting</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rateLimitMax">Max Jobs</Label>
                      <Input
                        id="rateLimitMax"
                        type="number"
                        min="1"
                        placeholder="No limit"
                        value={config.rateLimitMax || ''}
                        onChange={(e) => setConfig({ 
                          ...config, 
                          rateLimitMax: e.target.value ? parseInt(e.target.value) : null 
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rateLimitDuration">Per Duration (ms)</Label>
                      <Input
                        id="rateLimitDuration"
                        type="number"
                        min="1000"
                        placeholder="Duration in ms"
                        value={config.rateLimitDuration || ''}
                        onChange={(e) => setConfig({ 
                          ...config, 
                          rateLimitDuration: e.target.value ? parseInt(e.target.value) : null 
                        })}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Limit the number of jobs processed within a time window
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="alerts" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="alertOnFailureCount">Alert on Failure Count</Label>
                  <Input
                    id="alertOnFailureCount"
                    type="number"
                    min="1"
                    max="100"
                    value={config.alertOnFailureCount}
                    onChange={(e) => setConfig({ ...config, alertOnFailureCount: parseInt(e.target.value) || 5 })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Send alert when this many jobs fail consecutively
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alertOnQueueSize">Alert on Queue Size</Label>
                  <Input
                    id="alertOnQueueSize"
                    type="number"
                    min="10"
                    max="10000"
                    value={config.alertOnQueueSize}
                    onChange={(e) => setConfig({ ...config, alertOnQueueSize: parseInt(e.target.value) || 100 })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Send alert when queue size exceeds this threshold
                  </p>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={isLoading || isSaving}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isLoading || isSaving}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AnimatePresence>
  )
}