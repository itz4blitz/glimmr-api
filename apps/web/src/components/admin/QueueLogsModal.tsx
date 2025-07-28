import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Search,
  Download,
  RefreshCw,
  X,
  AlertCircle,
  XCircle,
  Info,
  Copy,
  Terminal,
  FileText,
  Maximize2,
  Minimize2,
  BarChart3,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface JobLog {
  id: string;
  timestamp: string;
  level: "info" | "warning" | "error" | "debug";
  message: string;
  data?: Record<string, unknown>;
  jobId?: string;
  attemptNumber?: number;
  progress?: number;
  duration?: number;
}

interface JobDetails {
  id: string;
  name: string;
  data: Record<string, unknown>;
  opts: Record<string, unknown>;
  attemptsMade: number;
  processedOn?: number;
  finishedOn?: number;
  returnvalue?: unknown;
  failedReason?: string;
  stacktrace?: string[];
  logs: JobLog[];
}

interface QueueMetrics {
  jobsPerMinute: number;
  avgProcessingTime: number;
  successRate: number;
  errorRate: number;
  activeWorkers: number;
  memoryUsage: number;
}

interface QueueLogsModalProps {
  queueName: string;
  displayName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function QueueLogsModal({
  queueName,
  displayName,
  isOpen,
  onClose,
}: QueueLogsModalProps) {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<JobLog[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobDetails | null>(null);
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(true); // Default to fullscreen
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [showJobIds, setShowJobIds] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState("live");

  // Fetch initial logs and metrics - moved before useEffect
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const [logsResponse, metricsResponse] = await Promise.all([
        api.get(`/jobs/queue/${queueName}/logs`, {
          params: { limit: 500 },
        }).catch(() => ({ data: [] })),
        api.get(`/jobs/monitoring/queue/${queueName}/performance`).catch(() => ({ data: null })),
      ]);
      // Ensure logs is always an array
      const logsData = Array.isArray(logsResponse.data) ? logsResponse.data : [];
      setLogs(logsData);
      setMetrics(metricsResponse.data);
    } catch (error) {
      console.error('Failed to load logs:', error);
      toast.error("Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [queueName]);

  // Periodic refresh for real-time logs (replaced WebSocket)
  useEffect(() => {
    if (!isOpen || !isLive) return;

    const interval = setInterval(() => {
      fetchLogs();
    }, 2000); // Refresh every 2 seconds when live mode is on

    return () => clearInterval(interval);
  }, [isOpen, isLive, fetchLogs]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  // Filter logs based on search and level
  useEffect(() => {
    let filtered = logs;

    if (selectedLevel !== "all") {
      filtered = filtered.filter((log) => log.level === selectedLevel);
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (log) =>
          log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.jobId?.includes(searchQuery) ||
          JSON.stringify(log.data).toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  }, [logs, searchQuery, selectedLevel]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  const handleExport = async () => {
    try {
      const response = await api.post(`/jobs/export`, {
        format: "csv",
        dataset: "logs",
        filters: { queue: queueName }
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${queueName}-logs-${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("Logs exported successfully");
    } catch (error) {
      console.error('Failed to export logs:', error);
      toast.error("Failed to export logs");
    }
  };

  const handleClearLogs = async () => {
    if (!confirm("Are you sure you want to clear all logs for this queue?")) return;

    try {
      // Clear logs is not available in current API
      toast.info("Clear logs feature is not available");
      return;
    } catch (error) {
      console.error('Failed to clear logs:', error);
      toast.error("Failed to clear logs");
    }
  };

  const fetchJobDetails = async (jobId: string) => {
    try {
      const response = await api.get(`/jobs/job/${jobId}/details`);
      setSelectedJob(response.data);
      setActiveTab("details");
    } catch (error) {
      console.error('Failed to load job details:', error);
      toast.error("Failed to load job details");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "info":
        return <Info className="h-4 w-4 text-blue-500" />;
      case "debug":
        return <Terminal className="h-4 w-4 text-gray-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case "error":
        return "text-red-500";
      case "warning":
        return "text-yellow-500";
      case "info":
        return "text-blue-500";
      case "debug":
        return "text-gray-500";
      default:
        return "text-gray-700";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={`${
          isFullscreen 
            ? "sm:max-w-[95vw] sm:w-[95vw] sm:max-h-[95vh] sm:h-[95vh]" 
            : "sm:max-w-6xl max-h-[90vh]"
        } flex flex-col p-0 overflow-hidden`}
        showCloseButton={false}
      >
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{displayName} Logs</DialogTitle>
              <DialogDescription>
                Real-time logs and job details for {queueName}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-6 py-2 border-b">
            <TabsList>
              <TabsTrigger value="live">Live Logs</TabsTrigger>
              <TabsTrigger value="details">Job Details</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="live" className="flex-1 flex flex-col m-0">
            {/* Controls */}
            <div className="px-6 py-3 border-b bg-muted/50">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search logs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Filter by level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="error">Errors</SelectItem>
                      <SelectItem value="warning">Warnings</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="debug">Debug</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchLogs}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearLogs}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Clear
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto-scroll"
                    checked={autoScroll}
                    onCheckedChange={(checked) => setAutoScroll(checked as boolean)}
                  />
                  <Label htmlFor="auto-scroll" className="text-sm">
                    Auto-scroll
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="show-timestamps"
                    checked={showTimestamps}
                    onCheckedChange={(checked) => setShowTimestamps(checked as boolean)}
                  />
                  <Label htmlFor="show-timestamps" className="text-sm">
                    Show timestamps
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="show-job-ids"
                    checked={showJobIds}
                    onCheckedChange={(checked) => setShowJobIds(checked as boolean)}
                  />
                  <Label htmlFor="show-job-ids" className="text-sm">
                    Show job IDs
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="live-mode"
                    checked={isLive}
                    onCheckedChange={(checked) => setIsLive(checked as boolean)}
                  />
                  <Label htmlFor="live-mode" className="text-sm">
                    Live mode (auto-refresh)
                  </Label>
                </div>
              </div>
            </div>

            {/* Logs */}
            <div className="flex-1 overflow-hidden">
              {loading ? (
                <div className="p-6 space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No logs found</p>
                  </div>
                </div>
              ) : (
                <ScrollArea className="h-full" ref={scrollRef}>
                  <div className="p-4 font-mono text-sm">
                    <AnimatePresence initial={false}>
                      {filteredLogs.map((log, index) => (
                        <motion.div
                          key={`${log.id}-${index}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-start gap-2 py-1 hover:bg-muted/50 px-2 -mx-2 rounded group"
                        >
                          {getLogIcon(log.level)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {showTimestamps && (
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {format(parseISO(log.timestamp), "HH:mm:ss.SSS")}
                                </span>
                              )}
                              {showJobIds && log.jobId && (
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="text-xs p-0 h-auto font-mono"
                                  onClick={() => log.jobId && fetchJobDetails(log.jobId)}
                                >
                                  #{log.jobId}
                                </Button>
                              )}
                              <span className={`${getLogColor(log.level)} break-all`}>
                                {log.message}
                              </span>
                            </div>
                            {log.data && (
                              <pre className="text-xs text-muted-foreground mt-1 overflow-x-auto">
                                {JSON.stringify(log.data, null, 2)}
                              </pre>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => copyToClipboard(log.message)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Status Bar */}
            <div className="px-6 py-2 border-t bg-muted/50 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">
                    {filteredLogs.length} logs
                  </span>
                  {isLive && (
                    <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
                      Live Mode
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Error: {logs.filter((l) => l.level === "error").length}</span>
                  <span>Warning: {logs.filter((l) => l.level === "warning").length}</span>
                  <span>Info: {logs.filter((l) => l.level === "info").length}</span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="details" className="flex-1 overflow-auto m-0 p-6">
            {selectedJob ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Job #{selectedJob.id}</CardTitle>
                    <CardDescription>
                      {selectedJob.name} • Attempt {selectedJob.attemptsMade}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Job Data</h4>
                      <pre className="text-sm bg-muted p-3 rounded-md overflow-auto">
                        {JSON.stringify(selectedJob.data, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2">Options</h4>
                      <pre className="text-sm bg-muted p-3 rounded-md overflow-auto">
                        {JSON.stringify(selectedJob.opts, null, 2)}
                      </pre>
                    </div>
                    {selectedJob.returnvalue !== undefined && selectedJob.returnvalue !== null && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Return Value</h4>
                        <pre className="text-sm bg-muted p-3 rounded-md overflow-auto">
                          {typeof selectedJob.returnvalue === 'string' 
                            ? selectedJob.returnvalue 
                            : JSON.stringify(selectedJob.returnvalue, null, 2)}
                        </pre>
                      </div>
                    )}
                    {selectedJob.failedReason && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Failed:</strong> {selectedJob.failedReason}
                          {selectedJob.stacktrace && (
                            <pre className="text-xs mt-2">
                              {selectedJob.stacktrace.join("\n")}
                            </pre>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Job Logs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      {selectedJob.logs.map((log, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-2 py-1 font-mono text-sm"
                        >
                          {getLogIcon(log.level)}
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(log.timestamp), "HH:mm:ss.SSS")}
                          </span>
                          <span className={getLogColor(log.level)}>{log.message}</span>
                        </div>
                      ))}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Info className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Click on a job ID in the logs to view details
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="metrics" className="flex-1 overflow-auto m-0 p-6">
            {metrics ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Throughput</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{metrics.jobsPerMinute || 0}/min</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Jobs processed per minute
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Avg Processing Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {((metrics.avgProcessingTime || 0) / 1000).toFixed(2)}s
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Average time per job
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Success Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{(metrics.successRate || 0).toFixed(1)}%</div>
                    <div className="w-full bg-secondary rounded-full h-2 mt-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${metrics.successRate || 0}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Error Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{(metrics.errorRate || 0).toFixed(1)}%</div>
                    <div className="w-full bg-secondary rounded-full h-2 mt-2">
                      <div
                        className="bg-red-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${metrics.errorRate || 0}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Active Workers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{metrics.activeWorkers || 0}</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Workers processing jobs
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Memory Usage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{metrics.memoryUsage || 0}MB</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Queue memory consumption
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Loading metrics...</p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}