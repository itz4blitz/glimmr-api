import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  Play,
  
  Edit2,
  Trash2,
  Plus,
  RefreshCw,
  
  
  
  
  
  
  
  ChevronDown,
  ChevronRight,
  History,
  TrendingUp,
  Copy,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { format, formatDistanceToNow, parseISO } from "date-fns";

interface ScheduledJob {
  id: string;
  name: string;
  queue: string;
  schedule: string;
  enabled: boolean;
  nextRun: string;
  lastRun?: string;
  lastStatus?: "success" | "failed";
  description?: string;
  data?: Record<string, unknown>;
  options?: {
    priority?: number;
    delay?: number;
    attempts?: number;
    backoff?: number;
    removeOnComplete?: boolean;
    removeOnFail?: boolean;
  };
  metadata?: {
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    runCount: number;
    successCount: number;
    failureCount: number;
    avgDuration?: number;
  };
}

interface JobHistory {
  id: string;
  jobId: string;
  jobName: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed";
  duration?: number;
  error?: string;
  result?: unknown;
}

const CRON_PRESETS = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every 30 minutes", value: "*/30 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Daily at 9 AM", value: "0 9 * * *" },
  { label: "Weekly on Monday", value: "0 0 * * 1" },
  { label: "Monthly on 1st", value: "0 0 1 * *" },
];

const QUEUE_OPTIONS = [
  { label: "PRA Unified Scan", value: "pra-unified-scan" },
  { label: "PRA File Download", value: "pra-file-download" },
  { label: "Price File Parser", value: "price-file-parser" },
  { label: "Price Normalization", value: "price-normalization" },
  { label: "Analytics Refresh", value: "analytics-refresh" },
  { label: "Export Data", value: "export-data" },
];

export function JobSchedulerPage() {
  const [loading, setLoading] = useState(true);
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>([]);
  const [jobHistory, setJobHistory] = useState<JobHistory[]>([]);
  // const [selectedJob, setSelectedJob] = useState<ScheduledJob | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  // const [showEditDialog, setShowEditDialog] = useState(false);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const fetchScheduledJobs = async () => {
    try {
      setRefreshing(true);
      const response = await api.get("/jobs/schedules");
      setScheduledJobs(response.data);
    } catch (error) {
      toast.error("Failed to load scheduled jobs");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchJobHistory = async () => {
    try {
      const response = await api.get("/jobs", {
        params: { limit: 50 }
      });
      // Transform job data to match history format
      const history = (response.data.data || []).map((job: {
        id: string;
        name?: string;
        queueName?: string;
        processedOn?: string;
        createdAt?: string;
        finishedOn?: string;
        status?: string;
        duration?: number;
        error?: string;
        result?: unknown;
        failedReason?: string;
        returnvalue?: unknown;
      }) => ({
        id: job.id,
        jobId: job.id,
        jobName: job.name || job.queueName,
        startedAt: job.processedOn || job.createdAt,
        completedAt: job.finishedOn,
        status: job.status === "completed" ? "completed" : job.status === "failed" ? "failed" : "running",
        duration: job.duration,
        error: job.failedReason,
        result: job.returnvalue,
      }));
      setJobHistory(history);
    } catch (error) {
    }
  };

  useEffect(() => {
    fetchScheduledJobs();
    fetchJobHistory();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchScheduledJobs();
      fetchJobHistory();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const toggleJobEnabled = async (scheduleId: string, enabled: boolean) => {
    try {
      await api.put(`/jobs/schedules/${scheduleId}`, { enabled });
      toast.success(`Job ${enabled ? "enabled" : "disabled"} successfully`);
      fetchScheduledJobs();
    } catch (error) {
      toast.error("Failed to update job status");
    }
  };

  const deleteJob = async (scheduleId: string) => {
    if (!confirm("Are you sure you want to delete this scheduled job?")) return;

    try {
      await api.delete(`/jobs/schedules/${scheduleId}`);
      toast.success("Job deleted successfully");
      fetchScheduledJobs();
    } catch (error) {
      toast.error("Failed to delete job");
    }
  };

  const runJobNow = async (scheduleId: string) => {
    try {
      await api.post(`/jobs/schedules/${scheduleId}/run`);
      toast.success("Job triggered successfully");
      fetchJobHistory();
    } catch (error) {
      toast.error("Failed to trigger job");
    }
  };

  const toggleExpanded = (jobId: string) => {
    const newExpanded = new Set(expandedJobs);
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId);
    } else {
      newExpanded.add(jobId);
    }
    setExpandedJobs(newExpanded);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="space-y-6">
            <Skeleton className="h-10 w-64" />
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Job Scheduler</h1>
            <p className="text-muted-foreground">
              Configure and manage scheduled background jobs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchScheduledJobs();
                fetchJobHistory();
              }}
              disabled={refreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <CreateJobDialog
              open={showCreateDialog}
              onOpenChange={setShowCreateDialog}
              onSuccess={() => {
                fetchScheduledJobs();
                setShowCreateDialog(false);
              }}
            />
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{scheduledJobs.length}</div>
              <p className="text-xs text-muted-foreground">
                {scheduledJobs.filter((j) => j.enabled).length} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Next Run</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {scheduledJobs
                  .filter((j) => j.enabled)
                  .sort((a, b) => new Date(a.nextRun).getTime() - new Date(b.nextRun).getTime())[0]
                  ? formatDistanceToNow(
                      parseISO(
                        scheduledJobs
                          .filter((j) => j.enabled)
                          .sort((a, b) => new Date(a.nextRun).getTime() - new Date(b.nextRun).getTime())[0].nextRun
                      ),
                      { addSuffix: true }
                    )
                  : "N/A"}
              </div>
              <p className="text-xs text-muted-foreground">
                {scheduledJobs
                  .filter((j) => j.enabled)
                  .sort((a, b) => new Date(a.nextRun).getTime() - new Date(b.nextRun).getTime())[0]?.name || "No active jobs"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {scheduledJobs.length > 0
                  ? (
                      (scheduledJobs.reduce((acc, job) => acc + (job.metadata?.successCount || 0), 0) /
                        scheduledJobs.reduce((acc, job) => acc + (job.metadata?.runCount || 0), 0)) *
                      100
                    ).toFixed(1)
                  : 0}
                %
              </div>
              <p className="text-xs text-muted-foreground">
                Overall job success rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Runs</CardTitle>
              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{jobHistory.length}</div>
              <p className="text-xs text-muted-foreground">
                Last 24 hours
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="jobs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="jobs">Scheduled Jobs</TabsTrigger>
            <TabsTrigger value="history">Execution History</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="jobs" className="space-y-4">
            {scheduledJobs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No scheduled jobs</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first scheduled job to automate background tasks
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Job
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {scheduledJobs.map((job) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-3 w-3 rounded-full ${
                                job.enabled ? "bg-green-500" : "bg-gray-400"
                              }`}
                            />
                            <div>
                              <CardTitle className="text-lg">{job.name}</CardTitle>
                              <CardDescription>{job.description || job.queue}</CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={job.enabled}
                              onCheckedChange={(checked) => toggleJobEnabled(job.id, checked)}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => runJobNow(job.id)}
                              disabled={!job.enabled}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <EditJobDialog
                              job={job}
                              onSuccess={() => fetchScheduledJobs()}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteJob(job.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleExpanded(job.id)}
                            >
                              {expandedJobs.has(job.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Schedule</p>
                            <p className="font-mono">{job.schedule}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Next Run</p>
                            <p>{format(parseISO(job.nextRun), "PPp")}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Last Run</p>
                            <p>
                              {job.lastRun ? (
                                <>
                                  {formatDistanceToNow(parseISO(job.lastRun), { addSuffix: true })}
                                  {job.lastStatus && (
                                    <Badge
                                      variant={job.lastStatus === "success" ? "success" : "destructive"}
                                      className="ml-2"
                                    >
                                      {job.lastStatus}
                                    </Badge>
                                  )}
                                </>
                              ) : (
                                "Never"
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Success Rate</p>
                            <p>
                              {job.metadata?.runCount
                                ? `${((job.metadata.successCount / job.metadata.runCount) * 100).toFixed(
                                    1
                                  )}% (${job.metadata.runCount} runs)`
                                : "N/A"}
                            </p>
                          </div>
                        </div>

                        <AnimatePresence>
                          {expandedJobs.has(job.id) && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3 }}
                              className="mt-4 pt-4 border-t"
                            >
                              <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                  <h4 className="text-sm font-medium mb-2">Job Data</h4>
                                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">
                                    {JSON.stringify(job.data || {}, null, 2)}
                                  </pre>
                                </div>
                                <div>
                                  <h4 className="text-sm font-medium mb-2">Job Options</h4>
                                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">
                                    {JSON.stringify(job.options || {}, null, 2)}
                                  </pre>
                                </div>
                              </div>
                              {job.metadata && (
                                <div className="mt-4">
                                  <h4 className="text-sm font-medium mb-2">Metadata</h4>
                                  <div className="grid gap-2 md:grid-cols-3 text-sm">
                                    <div>
                                      <p className="text-muted-foreground">Created By</p>
                                      <p>{job.metadata.createdBy}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Created At</p>
                                      <p>{format(parseISO(job.metadata.createdAt), "PPp")}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Avg Duration</p>
                                      <p>
                                        {job.metadata.avgDuration
                                          ? `${(job.metadata.avgDuration / 1000).toFixed(2)}s`
                                          : "N/A"}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Execution History</CardTitle>
                <CardDescription>
                  Recent job executions and their results
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobHistory.map((history, index) => (
                        <TableRow key={`${history.id}-${index}`}>
                          <TableCell className="font-medium">{history.jobName}</TableCell>
                          <TableCell>
                            {formatDistanceToNow(parseISO(history.startedAt), {
                              addSuffix: true,
                            })}
                          </TableCell>
                          <TableCell>
                            {history.duration
                              ? `${(history.duration / 1000).toFixed(2)}s`
                              : history.status === "running"
                              ? "Running..."
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                history.status === "completed"
                                  ? "success"
                                  : history.status === "failed"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {history.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {history.error ? (
                              <span className="text-red-500 text-sm">{history.error}</span>
                            ) : history.result ? (
                              <span className="text-green-500 text-sm">Success</span>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Job Templates</CardTitle>
                <CardDescription>
                  Pre-configured job templates for common tasks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    {
                      name: "Daily Analytics Refresh",
                      description: "Refresh analytics data every day at midnight",
                      queue: "analytics-refresh",
                      schedule: "0 0 * * *",
                      data: { scope: "all", force: true },
                    },
                    {
                      name: "Hourly Price Scan",
                      description: "Scan for new price files every hour",
                      queue: "pra-unified-scan",
                      schedule: "0 * * * *",
                      data: { testMode: false },
                    },
                    {
                      name: "Weekly Export",
                      description: "Export data every Sunday at 2 AM",
                      queue: "export-data",
                      schedule: "0 2 * * 0",
                      data: { format: "csv", compress: true },
                    },
                    {
                      name: "Database Cleanup",
                      description: "Clean up old data monthly",
                      queue: "maintenance",
                      schedule: "0 3 1 * *",
                      data: { daysToKeep: 90 },
                    },
                  ].map((template) => (
                    <Card key={template.name}>
                      <CardHeader>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <CardDescription>{template.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Queue:</span>{" "}
                            <span className="font-mono">{template.queue}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Schedule:</span>{" "}
                            <span className="font-mono">{template.schedule}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="mt-4 w-full"
                          onClick={() => {
                            // Pre-fill create dialog with template data
                            setShowCreateDialog(true);
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Use Template
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// Create Job Dialog Component
function CreateJobDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    queue: "",
    schedule: "",
    description: "",
    data: "{}",
    options: JSON.stringify(
      {
        priority: 0,
        attempts: 3,
        backoff: 5000,
        removeOnComplete: true,
        removeOnFail: false,
      },
      null,
      2
    ),
    enabled: true,
  });

  const handleSubmit = async () => {
    try {
      const payload = {
        ...formData,
        data: JSON.parse(formData.data),
        options: JSON.parse(formData.options),
      };

      await api.post("/jobs/schedules", payload);
      toast.success("Job created successfully");
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        name: "",
        queue: "",
        schedule: "",
        description: "",
        data: "{}",
        options: JSON.stringify(
          {
            priority: 0,
            attempts: 3,
            backoff: 5000,
            removeOnComplete: true,
            removeOnFail: false,
          },
          null,
          2
        ),
        enabled: true,
      });
    } catch (error) {
      toast.error("Failed to create job");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Job
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Scheduled Job</DialogTitle>
          <DialogDescription>
            Configure a new scheduled background job
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Job Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Daily Analytics Refresh"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="queue">Queue</Label>
              <Select
                value={formData.queue}
                onValueChange={(value) => setFormData({ ...formData, queue: value })}
              >
                <SelectTrigger id="queue">
                  <SelectValue placeholder="Select a queue" />
                </SelectTrigger>
                <SelectContent>
                  {QUEUE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule">Cron Schedule</Label>
            <div className="flex gap-2">
              <Input
                id="schedule"
                value={formData.schedule}
                onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                placeholder="0 0 * * *"
                className="font-mono"
              />
              <Select
                value={formData.schedule}
                onValueChange={(value) => setFormData({ ...formData, schedule: value })}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Presets" />
                </SelectTrigger>
                <SelectContent>
                  {CRON_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this job does..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data">Job Data (JSON)</Label>
            <Textarea
              id="data"
              value={formData.data}
              onChange={(e) => setFormData({ ...formData, data: e.target.value })}
              placeholder="{}"
              rows={4}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="options">Job Options (JSON)</Label>
            <Textarea
              id="options"
              value={formData.options}
              onChange={(e) => setFormData({ ...formData, options: e.target.value })}
              rows={6}
              className="font-mono text-sm"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
            <Label htmlFor="enabled">Enable immediately</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Create Job</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Edit Job Dialog Component
function EditJobDialog({
  job,
  onSuccess,
}: {
  job: ScheduledJob;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: job.name,
    schedule: job.schedule,
    description: job.description || "",
    data: JSON.stringify(job.data || {}, null, 2),
    options: JSON.stringify(job.options || {}, null, 2),
  });

  const handleSubmit = async () => {
    try {
      const payload = {
        ...formData,
        data: JSON.parse(formData.data),
        options: JSON.parse(formData.options),
      };

      await api.put(`/jobs/schedules/${job.id}`, payload);
      toast.success("Job updated successfully");
      onSuccess();
      setOpen(false);
    } catch (error) {
      toast.error("Failed to update job");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Edit2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Scheduled Job</DialogTitle>
          <DialogDescription>
            Update the configuration for this scheduled job
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Job Name</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-schedule">Cron Schedule</Label>
            <div className="flex gap-2">
              <Input
                id="edit-schedule"
                value={formData.schedule}
                onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                className="font-mono"
              />
              <Select
                value={formData.schedule}
                onValueChange={(value) => setFormData({ ...formData, schedule: value })}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Presets" />
                </SelectTrigger>
                <SelectContent>
                  {CRON_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-data">Job Data (JSON)</Label>
            <Textarea
              id="edit-data"
              value={formData.data}
              onChange={(e) => setFormData({ ...formData, data: e.target.value })}
              rows={4}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-options">Job Options (JSON)</Label>
            <Textarea
              id="edit-options"
              value={formData.options}
              onChange={(e) => setFormData({ ...formData, options: e.target.value })}
              rows={6}
              className="font-mono text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}