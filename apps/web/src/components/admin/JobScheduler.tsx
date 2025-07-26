import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Calendar,
  Clock,
  Plus,
  Edit,
  Trash2,
  Play,
  Copy,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { format, parseISO, addDays, addHours, addMinutes } from "date-fns";
// @ts-expect-error - cronstrue types not available
import cronstrue from "cronstrue";

interface JobTemplate {
  id: string;
  name: string;
  queueName: string;
  description: string;
  payload: Record<string, unknown>;
  options: {
    priority?: number;
    delay?: number;
    attempts?: number;
    backoff?: {
      type: "fixed" | "exponential";
      delay: number;
    };
    removeOnComplete?: boolean;
    removeOnFail?: boolean;
  };
}

interface ScheduledJob {
  id: string;
  name: string;
  queueName: string;
  schedule: string;
  timezone: string;
  enabled: boolean;
  lastRun?: string;
  nextRun: string;
  payload: Record<string, unknown>;
  options: Record<string, unknown>;
  history?: JobHistory[];
}

interface JobHistory {
  id: string;
  scheduledJobId: string;
  executedAt: string;
  status: "success" | "failed" | "running";
  duration?: number;
  error?: string;
  jobId: string;
}

interface JobSchedulerProps {
  queues: Array<{ name: string; displayName: string }>;
}

export function JobScheduler({ queues }: JobSchedulerProps) {
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>([]);
  // const [selectedTemplate, setSelectedTemplate] = useState<JobTemplate | null>(null);
  const [selectedScheduledJob, setSelectedScheduledJob] = useState<ScheduledJob | null>(null);
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false);
  const [isScheduleJobOpen, setIsScheduleJobOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("templates");
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [templateForm, setTemplateForm] = useState({
    name: "",
    queueName: "",
    description: "",
    payload: "{}",
    priority: 0,
    attempts: 3,
    backoffType: "exponential" as "fixed" | "exponential",
    backoffDelay: 1000,
    removeOnComplete: true,
    removeOnFail: false,
  });

  const [scheduleForm, setScheduleForm] = useState({
    name: "",
    templateId: "",
    scheduleType: "cron" as "cron" | "interval" | "date",
    cronExpression: "0 0 * * *",
    intervalValue: 60,
    intervalUnit: "minutes" as "minutes" | "hours" | "days",
    scheduledDate: "",
    timezone: "UTC",
    enabled: true,
  });

  useEffect(() => {
    fetchTemplates();
    fetchScheduledJobs();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await apiClient.get("/jobs/templates");
      setTemplates(response.data);
    } catch (error) {
      console.error("Failed to fetch templates:", error);
      toast.error("Failed to load job templates");
    }
  };

  const fetchScheduledJobs = async () => {
    try {
      const response = await apiClient.get("/jobs/scheduled");
      setScheduledJobs(response.data);
    } catch (error) {
      console.error("Failed to fetch scheduled jobs:", error);
      toast.error("Failed to load scheduled jobs");
    }
  };

  const fetchJobHistory = async (scheduledJobId: string) => {
    try {
      const response = await apiClient.get(`/jobs/scheduled/${scheduledJobId}/history`);
      return response.data;
    } catch (error) {
      console.error("Failed to fetch job history:", error);
      toast.error("Failed to load job history");
      return [];
    }
  };

  const createTemplate = async () => {
    try {
      setIsLoading(true);
      const payload = JSON.parse(templateForm.payload);
      
      const response = await apiClient.post("/jobs/templates", {
        name: templateForm.name,
        queueName: templateForm.queueName,
        description: templateForm.description,
        payload,
        options: {
          priority: templateForm.priority,
          attempts: templateForm.attempts,
          backoff: {
            type: templateForm.backoffType,
            delay: templateForm.backoffDelay,
          },
          removeOnComplete: templateForm.removeOnComplete,
          removeOnFail: templateForm.removeOnFail,
        },
      });

      setTemplates([...templates, response.data]);
      setIsCreateTemplateOpen(false);
      resetTemplateForm();
      toast.success("Job template created successfully");
    } catch (error) {
      toast.error(`Failed to create template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // const updateTemplate = async (id: string, updates: Partial<JobTemplate>) => {
  //   try {
  //     const response = await apiClient.put(`/jobs/templates/${id}`, updates);
  //     setTemplates(templates.map((t) => (t.id === id ? response.data : t)));
  //     toast.success("Template updated successfully");
  //   } catch (error) {
  //     toast.error(`Failed to update template: ${error instanceof Error ? error.message : 'Unknown error'}`);
  //   }
  // };

  const deleteTemplate = async (id: string) => {
    try {
      await apiClient.delete(`/jobs/templates/${id}`);
      setTemplates(templates.filter((t) => t.id !== id));
      toast.success("Template deleted successfully");
    } catch (error) {
      toast.error(`Failed to delete template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const scheduleJob = async () => {
    try {
      setIsLoading(true);
      const template = templates.find((t) => t.id === scheduleForm.templateId);
      if (!template) {
        toast.error("Please select a template");
        return;
      }

      let schedule = "";
      if (scheduleForm.scheduleType === "cron") {
        schedule = scheduleForm.cronExpression;
      } else if (scheduleForm.scheduleType === "interval") {
        schedule = `every ${scheduleForm.intervalValue} ${scheduleForm.intervalUnit}`;
      } else {
        schedule = scheduleForm.scheduledDate;
      }

      const response = await apiClient.post("/jobs/scheduled", {
        name: scheduleForm.name,
        queueName: template.queueName,
        schedule,
        timezone: scheduleForm.timezone,
        enabled: scheduleForm.enabled,
        payload: template.payload,
        options: template.options,
      });

      setScheduledJobs([...scheduledJobs, response.data]);
      setIsScheduleJobOpen(false);
      resetScheduleForm();
      toast.success("Job scheduled successfully");
    } catch (error) {
      toast.error(`Failed to schedule job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleScheduledJob = async (id: string, enabled: boolean) => {
    try {
      await apiClient.patch(`/jobs/scheduled/${id}`, { enabled });
      setScheduledJobs(
        scheduledJobs.map((job) =>
          job.id === id ? { ...job, enabled } : job
        )
      );
      toast.success(`Job ${enabled ? "enabled" : "disabled"} successfully`);
    } catch (error) {
      toast.error(`Failed to toggle job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const runScheduledJobNow = async (id: string) => {
    try {
      await apiClient.post(`/jobs/scheduled/${id}/run`);
      toast.success("Job triggered successfully");
      fetchScheduledJobs(); // Refresh to get updated lastRun
    } catch (error) {
      toast.error(`Failed to run job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const deleteScheduledJob = async (id: string) => {
    try {
      await apiClient.delete(`/jobs/scheduled/${id}`);
      setScheduledJobs(scheduledJobs.filter((job) => job.id !== id));
      toast.success("Scheduled job deleted successfully");
    } catch (error) {
      toast.error(`Failed to delete job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const duplicateTemplate = (template: JobTemplate) => {
    setTemplateForm({
      name: `${template.name} (Copy)`,
      queueName: template.queueName,
      description: template.description,
      payload: JSON.stringify(template.payload, null, 2),
      priority: template.options.priority || 0,
      attempts: template.options.attempts || 3,
      backoffType: template.options.backoff?.type || "exponential",
      backoffDelay: template.options.backoff?.delay || 1000,
      removeOnComplete: template.options.removeOnComplete || true,
      removeOnFail: template.options.removeOnFail || false,
    });
    setIsCreateTemplateOpen(true);
  };

  const resetTemplateForm = () => {
    setTemplateForm({
      name: "",
      queueName: "",
      description: "",
      payload: "{}",
      priority: 0,
      attempts: 3,
      backoffType: "exponential",
      backoffDelay: 1000,
      removeOnComplete: true,
      removeOnFail: false,
    });
  };

  const resetScheduleForm = () => {
    setScheduleForm({
      name: "",
      templateId: "",
      scheduleType: "cron",
      cronExpression: "0 0 * * *",
      intervalValue: 60,
      intervalUnit: "minutes",
      scheduledDate: "",
      timezone: "UTC",
      enabled: true,
    });
  };

  const getCronDescription = (expression: string) => {
    try {
      return cronstrue.toString(expression);
    } catch {
      return "Invalid cron expression";
    }
  };

  const getNextRunTime = (schedule: string) => {
    // This is a simplified version - in production, you'd use a proper cron parser
    const now = new Date();
    if (schedule.startsWith("every")) {
      const parts = schedule.split(" ");
      const value = parseInt(parts[1]);
      const unit = parts[2];
      
      switch (unit) {
        case "minutes":
          return addMinutes(now, value);
        case "hours":
          return addHours(now, value);
        case "days":
          return addDays(now, value);
        default:
          return now;
      }
    }
    return now;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Job Scheduler</CardTitle>
              <CardDescription>
                Create templates and schedule recurring jobs
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={isCreateTemplateOpen} onOpenChange={setIsCreateTemplateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Job Template</DialogTitle>
                    <DialogDescription>
                      Define a reusable job template for common tasks
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="template-name">Template Name</Label>
                        <Input
                          id="template-name"
                          value={templateForm.name}
                          onChange={(e) =>
                            setTemplateForm({ ...templateForm, name: e.target.value })
                          }
                          placeholder="e.g., Daily Analytics Refresh"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="template-queue">Queue</Label>
                        <Select
                          value={templateForm.queueName}
                          onValueChange={(value) =>
                            setTemplateForm({ ...templateForm, queueName: value })
                          }
                        >
                          <SelectTrigger id="template-queue">
                            <SelectValue placeholder="Select a queue" />
                          </SelectTrigger>
                          <SelectContent>
                            {queues.map((queue) => (
                              <SelectItem key={queue.name} value={queue.name}>
                                {queue.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="template-description">Description</Label>
                      <Textarea
                        id="template-description"
                        value={templateForm.description}
                        onChange={(e) =>
                          setTemplateForm({ ...templateForm, description: e.target.value })
                        }
                        placeholder="Describe what this job does..."
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="template-payload">Payload (JSON)</Label>
                      <Textarea
                        id="template-payload"
                        value={templateForm.payload}
                        onChange={(e) =>
                          setTemplateForm({ ...templateForm, payload: e.target.value })
                        }
                        placeholder='{"key": "value"}'
                        rows={5}
                        className="font-mono text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="template-priority">Priority</Label>
                        <Input
                          id="template-priority"
                          type="number"
                          value={templateForm.priority}
                          onChange={(e) =>
                            setTemplateForm({
                              ...templateForm,
                              priority: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="template-attempts">Max Attempts</Label>
                        <Input
                          id="template-attempts"
                          type="number"
                          value={templateForm.attempts}
                          onChange={(e) =>
                            setTemplateForm({
                              ...templateForm,
                              attempts: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="template-backoff-type">Backoff Type</Label>
                        <Select
                          value={templateForm.backoffType}
                          onValueChange={(value: "fixed" | "exponential") =>
                            setTemplateForm({ ...templateForm, backoffType: value })
                          }
                        >
                          <SelectTrigger id="template-backoff-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Fixed</SelectItem>
                            <SelectItem value="exponential">Exponential</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="template-backoff-delay">
                          Backoff Delay (ms)
                        </Label>
                        <Input
                          id="template-backoff-delay"
                          type="number"
                          value={templateForm.backoffDelay}
                          onChange={(e) =>
                            setTemplateForm({
                              ...templateForm,
                              backoffDelay: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="remove-on-complete">
                          Remove on complete
                        </Label>
                        <Switch
                          id="remove-on-complete"
                          checked={templateForm.removeOnComplete}
                          onCheckedChange={(checked) =>
                            setTemplateForm({
                              ...templateForm,
                              removeOnComplete: checked,
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="remove-on-fail">Remove on fail</Label>
                        <Switch
                          id="remove-on-fail"
                          checked={templateForm.removeOnFail}
                          onCheckedChange={(checked) =>
                            setTemplateForm({
                              ...templateForm,
                              removeOnFail: checked,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateTemplateOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={createTemplate} disabled={isLoading}>
                      {isLoading ? "Creating..." : "Create Template"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isScheduleJobOpen} onOpenChange={setIsScheduleJobOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule Job
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Schedule Job</DialogTitle>
                    <DialogDescription>
                      Create a scheduled job from a template
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="schedule-name">Job Name</Label>
                        <Input
                          id="schedule-name"
                          value={scheduleForm.name}
                          onChange={(e) =>
                            setScheduleForm({ ...scheduleForm, name: e.target.value })
                          }
                          placeholder="e.g., Nightly Analytics Update"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="schedule-template">Template</Label>
                        <Select
                          value={scheduleForm.templateId}
                          onValueChange={(value) =>
                            setScheduleForm({ ...scheduleForm, templateId: value })
                          }
                        >
                          <SelectTrigger id="schedule-template">
                            <SelectValue placeholder="Select a template" />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label>Schedule Type</Label>
                      <Tabs
                        value={scheduleForm.scheduleType}
                        onValueChange={(value) =>
                          setScheduleForm({ ...scheduleForm, scheduleType: value as "cron" | "interval" | "date" })
                        }
                      >
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="cron">Cron Expression</TabsTrigger>
                          <TabsTrigger value="interval">Interval</TabsTrigger>
                          <TabsTrigger value="date">Specific Date</TabsTrigger>
                        </TabsList>

                        <TabsContent value="cron" className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="cron-expression">
                              Cron Expression
                            </Label>
                            <Input
                              id="cron-expression"
                              value={scheduleForm.cronExpression}
                              onChange={(e) =>
                                setScheduleForm({
                                  ...scheduleForm,
                                  cronExpression: e.target.value,
                                })
                              }
                              placeholder="0 0 * * *"
                            />
                            <p className="text-sm text-muted-foreground">
                              {getCronDescription(scheduleForm.cronExpression)}
                            </p>
                          </div>
                        </TabsContent>

                        <TabsContent value="interval" className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="interval-value">Every</Label>
                              <Input
                                id="interval-value"
                                type="number"
                                value={scheduleForm.intervalValue}
                                onChange={(e) =>
                                  setScheduleForm({
                                    ...scheduleForm,
                                    intervalValue: parseInt(e.target.value),
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="interval-unit">Unit</Label>
                              <Select
                                value={scheduleForm.intervalUnit}
                                onValueChange={(value) =>
                                  setScheduleForm({
                                    ...scheduleForm,
                                    intervalUnit: value,
                                  })
                                }
                              >
                                <SelectTrigger id="interval-unit">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="minutes">Minutes</SelectItem>
                                  <SelectItem value="hours">Hours</SelectItem>
                                  <SelectItem value="days">Days</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="date" className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="scheduled-date">Date & Time</Label>
                            <Input
                              id="scheduled-date"
                              type="datetime-local"
                              value={scheduleForm.scheduledDate}
                              onChange={(e) =>
                                setScheduleForm({
                                  ...scheduleForm,
                                  scheduledDate: e.target.value,
                                })
                              }
                            />
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="schedule-timezone">Timezone</Label>
                        <Select
                          value={scheduleForm.timezone}
                          onValueChange={(value) =>
                            setScheduleForm({ ...scheduleForm, timezone: value })
                          }
                        >
                          <SelectTrigger id="schedule-timezone">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="UTC">UTC</SelectItem>
                            <SelectItem value="America/New_York">
                              Eastern Time
                            </SelectItem>
                            <SelectItem value="America/Chicago">
                              Central Time
                            </SelectItem>
                            <SelectItem value="America/Denver">
                              Mountain Time
                            </SelectItem>
                            <SelectItem value="America/Los_Angeles">
                              Pacific Time
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="schedule-enabled">Status</Label>
                        <div className="flex items-center space-x-2 pt-2">
                          <Switch
                            id="schedule-enabled"
                            checked={scheduleForm.enabled}
                            onCheckedChange={(checked) =>
                              setScheduleForm({ ...scheduleForm, enabled: checked })
                            }
                          />
                          <Label htmlFor="schedule-enabled">
                            {scheduleForm.enabled ? "Enabled" : "Disabled"}
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsScheduleJobOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={scheduleJob} disabled={isLoading}>
                      {isLoading ? "Scheduling..." : "Schedule Job"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="templates">
                Templates ({templates.length})
              </TabsTrigger>
              <TabsTrigger value="scheduled">
                Scheduled Jobs ({scheduledJobs.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="templates" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {templates.map((template) => (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <Card className="h-full">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                              {template.name}
                            </CardTitle>
                            <Badge variant="outline">{template.queueName}</Badge>
                          </div>
                          <CardDescription className="text-sm">
                            {template.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Priority:
                              </span>
                              <span>{template.options.priority || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Max Attempts:
                              </span>
                              <span>{template.options.attempts || 3}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Backoff:
                              </span>
                              <span>
                                {template.options.backoff?.type || "exponential"}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => duplicateTemplate(template)}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Duplicate Template</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      // TODO: Implement edit functionality
                                      toast.info("Edit functionality not yet implemented");
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit Template</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => deleteTemplate(template.id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete Template</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </TabsContent>

            <TabsContent value="scheduled" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Queue</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduledJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{job.queueName}</Badge>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="text-sm">
                              {job.schedule.includes("*")
                                ? getCronDescription(job.schedule)
                                : job.schedule}
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-mono">{job.schedule}</p>
                              <p className="text-xs text-muted-foreground">
                                Timezone: {job.timezone}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span className="text-sm">
                            {format(
                              getNextRunTime(job.schedule),
                              "MMM d, HH:mm"
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {job.lastRun ? (
                          <span className="text-sm text-muted-foreground">
                            {format(parseISO(job.lastRun), "MMM d, HH:mm")}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Never
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={job.enabled}
                          onCheckedChange={(checked) =>
                            toggleScheduledJob(job.id, checked)
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => runScheduledJobNow(job.id)}
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Run Now</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={async () => {
                                    const history = await fetchJobHistory(job.id);
                                    setSelectedScheduledJob({ ...job, history });
                                    setIsHistoryOpen(true);
                                  }}
                                >
                                  <History className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View History</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteScheduledJob(job.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Job History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Job History: {selectedScheduledJob?.name}
            </DialogTitle>
            <DialogDescription>
              Recent execution history for this scheduled job
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Executed At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedScheduledJob?.history?.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {format(parseISO(record.executedAt), "MMM d, HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          record.status === "success"
                            ? "default"
                            : record.status === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {record.duration
                        ? `${(record.duration / 1000).toFixed(1)}s`
                        : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {record.jobId}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {record.error || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}