import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  
  Search,
  
  Download,
  
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Database,
  Activity,
  ChevronRight,
  RefreshCw,
  
  Info,
  Calendar,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { JobExecutionTimeline } from "./JobExecutionTimeline";
import { useBatchElapsedTime } from "@/hooks/useElapsedTime";
import { JobHealthIndicator } from "./JobHealthIndicator";
import { JobStatusSummary } from "./JobStatusSummary";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogPortal,
} from "@/components/ui/alert-dialog";

interface LogEntry {
  id: string;
  jobId: string;
  jobName: string;
  queueName: string;
  level: "info" | "warning" | "error" | "success";
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
  createdAt: string;
  status?: string;
  duration?: number;
  attemptNumber?: number;
  error?: string;
  stackTrace?: string;
}

interface AllLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AllLogsModal({ isOpen, onClose }: AllLogsModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [queueFilter, setQueueFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const fetchAllLogs = useCallback(async () => {
    if (!isOpen) return;

    setIsLoading(true);
    try {
      const response = await apiClient.get("/jobs/logs", {
        params: {
          limit: 500,
          level: levelFilter === "all" ? undefined : levelFilter,
          queue: queueFilter === "all" ? undefined : queueFilter,
          status: statusFilter === "all" ? undefined : statusFilter,
          search: searchTerm || undefined,
        },
      });

      const logsData = response.data.logs || response.data || [];
      setLogs(logsData);
    } catch (error) {
      console.error('Failed to load job logs:', error);
      toast.error("Failed to load job logs");
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, levelFilter, queueFilter, statusFilter, searchTerm]);

  useEffect(() => {
    if (isOpen) {
      fetchAllLogs();

      if (isAutoRefresh) {
        const interval = setInterval(fetchAllLogs, 10000); // Increased from 5s to 10s
        return () => clearInterval(interval);
      }
    }
  }, [
    isOpen,
    levelFilter,
    queueFilter,
    statusFilter,
    searchTerm,
    isAutoRefresh,
    fetchAllLogs,
  ]);

  const filteredLogs = logs.filter((log) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      log.message?.toLowerCase().includes(searchLower) ||
      log.jobId?.toLowerCase().includes(searchLower) ||
      log.jobName?.toLowerCase().includes(searchLower);

    // Date filtering
    const logDate = new Date(log.timestamp || log.createdAt);
    const matchesDateFrom =
      !dateFrom || logDate >= new Date(dateFrom + "T00:00:00");
    const matchesDateTo = !dateTo || logDate <= new Date(dateTo + "T23:59:59");

    return matchesSearch && matchesDateFrom && matchesDateTo;
  });

  // Prepare data for elapsed time calculation
  const activeJobs = useMemo(() => {
    return filteredLogs
      .filter((log) => {
        const isActive =
          log.status === "active" ||
          log.message?.toLowerCase().includes("job started") ||
          log.message?.toLowerCase().includes("is being processed") ||
          log.message?.toLowerCase().includes("processing") ||
          (log.status === "unknown" &&
            log.level === "info" &&
            log.message?.toLowerCase().includes("job"));
        return isActive;
      })
      .map((log) => {
        // Use jobId as the key since that's what identifies a unique job
        return {
          id: log.jobId,
          logId: log.id,
          startTime: log.timestamp || log.createdAt,
          isActive: true,
        };
      });
  }, [filteredLogs]);

  const elapsedTimes = useBatchElapsedTime(activeJobs, 1000); // Update every second

  const toggleRowExpanded = (logId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedRows(newExpanded);
  };

  const getLevelIcon = (level: string) => {
    switch (level?.toLowerCase()) {
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "warn":
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "info":
        return <Info className="h-4 w-4 text-blue-500" />;
      case "debug":
        return <Zap className="h-4 w-4 text-gray-500" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  const getLevelVariant = (
    level: string,
  ): "default" | "destructive" | "outline" | "secondary" => {
    switch (level?.toLowerCase()) {
      case "error":
        return "destructive";
      case "warn":
      case "warning":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getStatusBadge = (log: LogEntry) => {
    // If message indicates job started, show active status
    if (log.message?.toLowerCase().includes("job started")) {
      return (
        <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
          Started
        </Badge>
      );
    }

    if (log.status === "completed") {
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
          Completed
        </Badge>
      );
    } else if (log.status === "failed" || log.level === "error") {
      return <Badge variant="destructive">Failed</Badge>;
    } else if (log.status === "active") {
      return (
        <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
          Active
        </Badge>
      );
    } else if (log.status === "waiting") {
      return <Badge variant="secondary">Waiting</Badge>;
    } else if (log.status === "delayed") {
      return <Badge variant="outline">Delayed</Badge>;
    } else if (log.message?.toLowerCase().includes("job created")) {
      return <Badge variant="secondary">Created</Badge>;
    }

    // Default to showing the log level if no status
    if (log.level === "info") {
      return <Badge variant="secondary">Processing</Badge>;
    } else if (log.level === "success") {
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
          Success
        </Badge>
      );
    }

    return <Badge variant="secondary">In Progress</Badge>;
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "N/A";

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "Invalid Date";
      }

      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(date);
    } catch {
      return "Invalid Date";
    }
  };

  const formatDuration = (
    ms: number | undefined,
    jobId?: string | null,
    status?: string | null,
    message?: string | null,
  ) => {
    // Check if this is an active job based on status or message
    const isActiveJob =
      status === "active" ||
      message?.toLowerCase().includes("job started") ||
      message?.toLowerCase().includes("is being processed") ||
      message?.toLowerCase().includes("processing") ||
      (status === "unknown" && message?.toLowerCase().includes("job"));

    // For completed jobs, show the actual duration from the log
    if (ms && ms > 0 && !isActiveJob) {
      const formatted =
        ms < 1000
          ? `${ms}ms`
          : ms < 60000
            ? `${(ms / 1000).toFixed(1)}s`
            : ms < 3600000
              ? `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
              : `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;

      return <span className="font-mono">{formatted}</span>;
    }

    // For active jobs, show elapsed time with pulsing indicator
    if (isActiveJob && jobId && elapsedTimes[jobId]) {
      return (
        <div className="flex items-center justify-end gap-1.5">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </div>
          <span className="font-mono">{elapsedTimes[jobId]}</span>
        </div>
      );
    }

    if (isActiveJob) {
      return (
        <div className="flex items-center justify-end gap-1.5">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </div>
          <span className="text-muted-foreground">Starting...</span>
        </div>
      );
    }

    return <span className="text-muted-foreground">N/A</span>;
  };

  const getQueueDisplayName = (queueName: string) => {
    const displayNames: Record<string, string> = {
      "price-file-download": "Price File Download",
      "price-file-parser": "Price File Parser",
      "price-update": "Price Normalization",
      "analytics-refresh": "Analytics Refresh",
      "export-data": "Data Export",
      "pra-unified-scan": "Hospital Discovery",
      "pra-file-download": "File Downloads (PRA)",
    };
    return displayNames[queueName] || queueName;
  };

  const exportLogs = () => {
    const csvContent = [
      [
        "Timestamp",
        "Queue",
        "Job ID",
        "Level",
        "Status",
        "Message",
        "Duration",
      ].join(","),
      ...filteredLogs.map((log) =>
        [
          formatDate(log.timestamp || log.createdAt),
          log.queueName,
          log.jobId,
          log.level,
          log.status || "",
          `"${log.message.replace(/"/g, '""')}"`,
          formatDuration(log.duration, null, null, null),
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs exported successfully");
  };

  const handleResetLogs = async (retryCount = 0) => {
    setIsResetting(true);

    try {
      const response = await apiClient.delete("/jobs/logs/reset");

      if (response.data.success) {
        toast.success("All logs have been reset successfully");
        setShowResetDialog(false);
        setLogs([]);
        // Refresh the logs
        fetchAllLogs();
        setIsResetting(false);
      } else {
        toast.error("Failed to reset logs");
        setIsResetting(false);
      }
    } catch (error) {

      // Handle rate limiting with retry
      const err = error as { response?: { status?: number; data?: { message?: string } } };
      if (err.response?.status === 429 && retryCount < 3) {
        const retryDelay = (retryCount + 1) * 2000; // 2s, 4s, 6s
        toast.info(
          `Rate limit reached. Retrying in ${retryDelay / 1000} seconds...`,
        );
        // shouldRetry = true;

        setTimeout(() => {
          handleResetLogs(retryCount + 1);
        }, retryDelay);
      } else {
        const errorMessage =
          err.response?.status === 429
            ? "Too many requests. Please wait a moment and try again."
            : err.response?.data?.message || "Failed to reset logs";

        toast.error(errorMessage);
        setIsResetting(false);
      }
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] flex flex-col">
          <DialogHeader className="pr-12">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Job Logs Dashboard
                </DialogTitle>
                <DialogDescription>
                  Real-time logs and activity for all background job queues
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2 mr-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                  className={cn(isAutoRefresh && "border-green-600")}
                >
                  <RefreshCw
                    className={cn(
                      "h-4 w-4 mr-1",
                      isAutoRefresh && "animate-spin",
                    )}
                  />
                  {isAutoRefresh ? "Auto-refresh On" : "Auto-refresh Off"}
                </Button>
                <Button variant="outline" size="sm" onClick={exportLogs}>
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResetDialog(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Reset All Logs
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Stuck Job Warning */}
          {(() => {
            const stuckJobs = filteredLogs.filter((log) => {
              if (
                log.status !== "active" &&
                !log.message?.toLowerCase().includes("is being processed")
              )
                return false;
              const elapsed =
                Date.now() - new Date(log.timestamp || log.createdAt).getTime();
              const hours = elapsed / (1000 * 60 * 60);
              return hours > 2; // Jobs running > 2 hours
            });

            if (stuckJobs.length > 0) {
              return (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <p className="text-sm font-medium text-red-600">
                      {stuckJobs.length} job{stuckJobs.length > 1 ? "s" : ""}{" "}
                      may be stuck
                    </p>
                    <span className="text-xs text-red-600/80">
                      (running for over 2 hours)
                    </span>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Graph Section */}
          <div className="py-4 border-b bg-muted/10">
            <JobExecutionTimeline
              logs={logs.map(log => ({
                ...log,
                context: {
                  jobName: log.jobName,
                  duration: log.duration,
                  state: log.status
                }
              }))}
              queueName={queueFilter !== "all" ? queueFilter : undefined}
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 py-4 border-b">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2 items-center">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px]"
                placeholder="From date"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px]"
                placeholder="To date"
              />
            </div>

            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
                <SelectItem value="success">Success</SelectItem>
              </SelectContent>
            </Select>

            <Select value={queueFilter} onValueChange={setQueueFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Queue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Queues</SelectItem>
                <SelectItem value="price-file-download">
                  Price File Parser
                </SelectItem>
                <SelectItem value="price-update">
                  Price Normalization
                </SelectItem>
                <SelectItem value="analytics-refresh">
                  Analytics Refresh
                </SelectItem>
                <SelectItem value="export-data">Data Export</SelectItem>
                <SelectItem value="pra-unified-scan">
                  Hospital Discovery
                </SelectItem>
                <SelectItem value="pra-file-download">
                  File Downloads
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="active">Active</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={fetchAllLogs}
              disabled={isLoading}
            >
              <RefreshCw
                className={cn("h-4 w-4", isLoading && "animate-spin")}
              />
            </Button>
          </div>

          {/* Logs Table */}
          <ScrollArea className="flex-1 relative overflow-auto">
            {isLoading && filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Database className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No Logs Found
                </h3>
                <p className="text-muted-foreground">
                  {searchTerm ||
                  levelFilter !== "all" ||
                  queueFilter !== "all" ||
                  statusFilter !== "all"
                    ? "No logs match your current filters."
                    : "No job logs have been recorded yet."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30px]"></TableHead>
                    <TableHead className="w-[140px]">Timestamp</TableHead>
                    <TableHead className="w-[180px]">Queue</TableHead>
                    <TableHead className="w-[120px]">Job ID</TableHead>
                    <TableHead className="w-[80px]">Level</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="w-[100px] text-right">
                      Duration
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {filteredLogs.map((log, index) => {
                      const isExpanded = expandedRows.has(log.id);
                      return (
                        <React.Fragment key={log.id}>
                          <motion.tr
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: Math.min(index * 0.02, 0.2) }}
                            className={cn(
                              "hover:bg-muted/50 cursor-pointer",
                              isExpanded && "bg-muted/30",
                            )}
                            onClick={() => toggleRowExpanded(log.id)}
                          >
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRowExpanded(log.id);
                                }}
                              >
                                <ChevronRight
                                  className={cn(
                                    "h-4 w-4 transition-transform",
                                    isExpanded && "rotate-90",
                                  )}
                                />
                              </Button>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {formatDate(log.timestamp || log.createdAt)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-normal">
                                {getQueueDisplayName(log.queueName)}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger className="cursor-help">
                                    {log.jobId?.substring(0, 8)}...
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-mono text-xs">
                                      {log.jobId}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {getLevelIcon(log.level)}
                                <Badge
                                  variant={getLevelVariant(log.level)}
                                  className="text-xs"
                                >
                                  {log.level?.toUpperCase() || "INFO"}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(log)}</TableCell>
                            <TableCell className="max-w-md">
                              <div
                                className="truncate text-sm"
                                title={log.message}
                              >
                                {log.message}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatDuration(
                                log.duration,
                                log.jobId,
                                log.status,
                                log.message,
                              )}
                            </TableCell>
                          </motion.tr>

                          {isExpanded && (
                            <motion.tr
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <TableCell
                                colSpan={8}
                                className="p-0 bg-muted/30"
                              >
                                <div className="p-6 border-b-2 border-border/50">
                                  {/* Job Status Summary */}
                                  <div className="mb-6">
                                    <JobStatusSummary
                                      log={log}
                                      elapsedTime={elapsedTimes[log.jobId]}
                                    />
                                  </div>

                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                      <div>
                                        <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">
                                          Job Details
                                        </h4>
                                        <dl className="space-y-2 text-sm">
                                          <div className="flex justify-between py-1 border-b border-border/30">
                                            <dt className="font-medium text-muted-foreground">
                                              Job Name:
                                            </dt>
                                            <dd className="font-mono text-right">
                                              {log.jobName}
                                            </dd>
                                          </div>
                                          <div className="flex justify-between py-1 border-b border-border/30">
                                            <dt className="font-medium text-muted-foreground">
                                              Job ID:
                                            </dt>
                                            <dd
                                              className="font-mono text-xs text-right break-all"
                                              title={log.jobId}
                                            >
                                              {log.jobId}
                                            </dd>
                                          </div>
                                          <div className="flex justify-between py-1 border-b border-border/30">
                                            <dt className="font-medium text-muted-foreground">
                                              Log ID:
                                            </dt>
                                            <dd className="font-mono text-xs text-right">
                                              {log.id}
                                            </dd>
                                          </div>
                                          <div className="flex justify-between py-1 border-b border-border/30">
                                            <dt className="font-medium text-muted-foreground">
                                              Queue:
                                            </dt>
                                            <dd className="text-right">
                                              {log.queueName}
                                            </dd>
                                          </div>
                                          {log.attemptNumber !== undefined && (
                                            <div className="flex justify-between py-1 border-b border-border/30">
                                              <dt className="font-medium text-muted-foreground">
                                                Attempt:
                                              </dt>
                                              <dd className="text-right">
                                                {log.attemptNumber}
                                              </dd>
                                            </div>
                                          )}
                                        </dl>
                                      </div>
                                    </div>

                                    <div className="space-y-4">
                                      <div>
                                        <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">
                                          Message
                                        </h4>
                                        <div className="bg-background/50 p-4 rounded-lg border text-sm">
                                          {log.message}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Job Health Indicator for active/long-running jobs */}
                                  {(log.status === "active" ||
                                    log.message
                                      ?.toLowerCase()
                                      .includes("job started") ||
                                    log.message
                                      ?.toLowerCase()
                                      .includes("is being processed")) && (
                                    <div className="mt-6">
                                      <JobHealthIndicator
                                        startTime={
                                          log.timestamp || log.createdAt
                                        }
                                        status={log.status || "active"}
                                        jobName={log.jobName}
                                        message={log.message}
                                        progress={(() => {
                                          // Try to get progress from context
                                          const ctx = log.context;
                                          if (ctx?.progress)
                                            return ctx.progress;

                                          // For download jobs, check if progress info is in context directly
                                          if (
                                            ctx?.bytesDownloaded !==
                                              undefined ||
                                            ctx?.percentage !== undefined
                                          ) {
                                            return {
                                              percentage: ctx.percentage,
                                              bytesDownloaded:
                                                ctx.bytesDownloaded,
                                              totalBytes: ctx.totalBytes,
                                              speed: ctx.speed,
                                              eta: ctx.eta,
                                            };
                                          }

                                          // Check if it's in the data property
                                          if (ctx && typeof ctx === 'object' && 'data' in ctx) {
                                            const data = ctx.data as { progress?: unknown };
                                            if (data?.progress) return data.progress;
                                          }

                                          return undefined;
                                        })()}
                                      />
                                    </div>
                                  )}

                                  {log.error && (
                                    <div className="mt-6">
                                      <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-red-600 dark:text-red-400">
                                        Error Details
                                      </h4>
                                      <pre className="text-xs bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border border-red-200 dark:border-red-800/50 overflow-auto font-mono">
                                        {log.error}
                                      </pre>
                                    </div>
                                  )}

                                  {log.stackTrace && (
                                    <div className="mt-6">
                                      <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">
                                        Stack Trace
                                      </h4>
                                      <pre className="text-xs bg-muted/30 p-4 rounded-lg border overflow-auto max-h-48 font-mono">
                                        {log.stackTrace}
                                      </pre>
                                    </div>
                                  )}

                                  {log.context &&
                                    Object.keys(log.context).length > 0 && (
                                      <div className="mt-6">
                                        <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">
                                          Additional Context
                                        </h4>
                                        <pre className="text-xs bg-muted/30 p-4 rounded-lg border overflow-auto max-h-64 font-mono">
                                          <code className="language-json">
                                            {JSON.stringify(
                                              log.context,
                                              null,
                                              2,
                                            )}
                                          </code>
                                        </pre>
                                      </div>
                                    )}
                                </div>
                              </TableCell>
                            </motion.tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </AnimatePresence>
                </TableBody>
              </Table>
            )}
          </ScrollArea>

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {filteredLogs.length} of {logs.length} log entries
              {isAutoRefresh && (
                <span className="ml-2">(Auto-refreshing every 10s)</span>
              )}
            </div>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogPortal>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Reset All Logs
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">
                  This action will permanently delete all job logs from the
                  database. This operation cannot be undone.
                </span>
                <span className="block font-semibold">
                  Are you absolutely sure you want to proceed?
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleResetLogs()}
                disabled={isResetting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Yes, Reset All Logs"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogPortal>
      </AlertDialog>
    </>
  );
}
