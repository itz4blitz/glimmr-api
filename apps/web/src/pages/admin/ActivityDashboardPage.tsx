import { useState, useEffect, useCallback } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity,
  Search,
  User,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

interface ActivityLog {
  id: string;
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: {
    previousValue?: string | number | boolean;
    newValue?: string | number | boolean;
    changes?: Record<string, unknown>;
    [key: string]: unknown;
  };
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
  errorMessage?: string;
  timestamp: string;
  user?: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

interface ActivityStats {
  totalActivities: number;
  successfulActivities: number;
  failedActivities: number;
  uniqueUsers: number;
  topActions: Array<{ action: string; count: number }>;
  activityByHour: Array<{ hour: number; count: number }>;
}

export function ActivityDashboardPage() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [resourceFilter, setResourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("24h");

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (searchTerm) params.append("search", searchTerm);
      if (actionFilter !== "all") params.append("action", actionFilter);
      if (resourceFilter !== "all")
        params.append("resourceType", resourceFilter);
      if (statusFilter !== "all")
        params.append("success", statusFilter === "success" ? "true" : "false");
      if (timeFilter !== "all") params.append("timeRange", timeFilter);

      const response = await apiClient.get(
        `/api/v1/activity?${params.toString()}`,
      );
      setActivities(response.data.activities || []);
      setTotal(response.data.total || 0);
      setTotalPages(response.data.totalPages || 0);
    } catch (error) {
      console.error('Failed to fetch activity data:', error);
      toast.error("Failed to load activities");
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchTerm, actionFilter, resourceFilter, statusFilter, timeFilter]);

  const loadStats = async () => {
    try {
      const response = await apiClient.get("/api/v1/activity/stats");
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch activity data:', error);
      // Silently fail for stats loading
    }
  };

  useEffect(() => {
    loadActivities();
    loadStats();
  }, [page, actionFilter, resourceFilter, statusFilter, timeFilter, loadActivities]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await Promise.all([loadActivities(), loadStats()]);
    setRefreshing(false);
    toast.success("Activity data refreshed");
  };

  const handleExport = async () => {
    try {
      const response = await apiClient.get("/api/v1/activity/export", {
        responseType: "blob",
        params: {
          format: "csv",
          timeRange: timeFilter,
        },
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `activity-logs-${format(new Date(), "yyyy-MM-dd")}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("Activity logs exported successfully");
    } catch (error) {
      console.error('Failed to fetch activity data:', error);
      toast.error("Failed to export activity logs");
    }
  };

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("create") || action.includes("add")) return "default";
    if (action.includes("update") || action.includes("edit"))
      return "secondary";
    if (action.includes("delete") || action.includes("remove"))
      return "destructive";
    if (action.includes("auth") || action.includes("login")) return "outline";
    if (action.includes("job")) return "secondary";
    return "outline";
  };

  const getStatusIcon = (success?: boolean) => {
    if (success === true)
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (success === false) return <XCircle className="h-4 w-4 text-red-500" />;
    return <AlertCircle className="h-4 w-4 text-gray-400" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Activity Dashboard
        </h1>
        <p className="text-muted-foreground">
          Monitor all user activities and system operations
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Activities
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalActivities.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                In selected time range
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Success Rate
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalActivities > 0
                  ? Math.round(
                      (stats.successfulActivities / stats.totalActivities) *
                        100,
                    )
                  : 0}
                %
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.successfulActivities} successful
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Failed Activities
              </CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.failedActivities}</div>
              <p className="text-xs text-muted-foreground">
                Errors and failures
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Users
              </CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.uniqueUsers}</div>
              <p className="text-xs text-muted-foreground">
                Unique users active
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Activity Logs</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filter Controls */}
            <div className="grid gap-4 md:grid-cols-5">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search activities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setPage(1);
                      loadActivities();
                    }
                  }}
                  className="pl-8"
                />
              </div>

              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last hour</SelectItem>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>

              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="auth">Authentication</SelectItem>
                  <SelectItem value="user">User management</SelectItem>
                  <SelectItem value="job">Job operations</SelectItem>
                  <SelectItem value="api">API requests</SelectItem>
                </SelectContent>
              </Select>

              <Select value={resourceFilter} onValueChange={setResourceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All resources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All resources</SelectItem>
                  <SelectItem value="user">Users</SelectItem>
                  <SelectItem value="hospital">Hospitals</SelectItem>
                  <SelectItem value="job">Jobs</SelectItem>
                  <SelectItem value="price">Prices</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Activity Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Status</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={7}>
                          <Skeleton className="h-12 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : activities.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground"
                      >
                        No activities found
                      </TableCell>
                    </TableRow>
                  ) : (
                    activities.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell>{getStatusIcon(activity.success)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {format(
                                new Date(activity.timestamp),
                                "MMM dd, HH:mm:ss",
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(
                                new Date(activity.timestamp),
                                { addSuffix: true },
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {activity.user ? (
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                {activity.user.email}
                              </span>
                              {(activity.user.firstName ||
                                activity.user.lastName) && (
                                <span className="text-xs text-muted-foreground">
                                  {activity.user.firstName}{" "}
                                  {activity.user.lastName}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              System
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={getActionBadgeVariant(activity.action)}
                          >
                            {activity.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {activity.resourceType && (
                            <div className="flex flex-col">
                              <span className="text-sm">
                                {activity.resourceType}
                              </span>
                              {activity.resourceId && (
                                <span className="text-xs text-muted-foreground">
                                  {activity.resourceId.substring(0, 8)}...
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {activity.ipAddress || "N/A"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  // Show activity details in a toast for now
                                  toast.info(
                                    <div className="space-y-2">
                                      <p className="font-semibold">Activity Details</p>
                                      <p className="text-sm">ID: {activity.id}</p>
                                      <p className="text-sm">Action: {activity.action}</p>
                                      <p className="text-sm">Resource: {activity.resourceType} ({activity.resourceId})</p>
                                      <p className="text-sm">Status: {activity.success ? 'Success' : 'Failed'}</p>
                                      {activity.errorMessage && (
                                        <p className="text-sm text-red-500">Error: {activity.errorMessage}</p>
                                      )}
                                    </div>,
                                    { duration: 5000 }
                                  );
                                }}
                              >
                                View details
                              </DropdownMenuItem>
                              {activity.userId && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    // Navigate to user profile
                                    window.location.href = `/admin/users/${activity.userId}`;
                                  }}
                                >
                                  View user
                                </DropdownMenuItem>
                              )}
                              {activity.errorMessage && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    toast.error(activity.errorMessage);
                                  }}
                                >
                                  View error
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * limit + 1} to{" "}
                  {Math.min(page * limit, total)} of {total} activities
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
