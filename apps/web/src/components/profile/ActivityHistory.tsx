import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Smartphone,
  CheckCircle,
  XCircle,
  Shield,
  User,
  Settings,
  Upload,
  Download,
  Trash2,
  Edit,
  Eye,
  
  
  X,
} from "lucide-react";
import {
  formatDistanceToNow,
  format,
  isWithinInterval,
  startOfDay,
  endOfDay,
} from "date-fns";
import { apiClient } from "@/lib/api";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";

interface ActivityLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  metadata?: any;
  errorMessage?: string;
}

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

type ActivityCategory =
  | "authentication"
  | "account"
  | "data"
  | "administrative"
  | "security"
  | "system";
type ActivityImportance = "high" | "medium" | "low";

const getActivityIcon = (action: string, size = "h-4 w-4") => {
  const iconClass = size;
  if (action.includes("login")) return <Shield className={iconClass} />;
  if (action.includes("profile")) return <User className={iconClass} />;
  if (action.includes("preferences")) return <Settings className={iconClass} />;
  if (action.includes("upload")) return <Upload className={iconClass} />;
  if (action.includes("download")) return <Download className={iconClass} />;
  if (action.includes("delete")) return <Trash2 className={iconClass} />;
  if (action.includes("update")) return <Edit className={iconClass} />;
  if (action.includes("view")) return <Eye className={iconClass} />;
  return <Activity className={iconClass} />;
};

const getActivityDescription = (activity: ActivityLog) => {
  switch (activity.action) {
    case "login":
      return "Signed in to account";
    case "login_failed":
      return "Failed sign-in attempt";
    case "logout":
      return "Signed out of account";
    case "profile_update":
      return "Updated profile information";
    case "avatar_upload":
      return "Uploaded new avatar";
    case "avatar_remove":
      return "Removed avatar";
    case "preferences_update":
      return "Updated preferences";
    case "password_change":
      return "Changed password";
    case "password_reset":
      return "Reset password";
    case "password_reset_request":
      return "Requested password reset";
    case "email_change":
      return "Changed email address";
    case "email_verify":
      return "Verified email address";
    case "two_factor_enable":
      return "Enabled two-factor authentication";
    case "two_factor_disable":
      return "Disabled two-factor authentication";
    case "api_key_create":
      return "Created API key";
    case "api_key_delete":
      return "Deleted API key";
    case "file_upload":
      return "Uploaded file";
    case "file_download":
      return "Downloaded file";
    case "file_delete":
      return "Deleted file";
    case "file_view":
      return "Viewed file";
    case "account_create":
      return "Created account";
    case "account_delete":
      return "Deleted account";
    case "session_expire":
      return "Session expired";
    case "permission_change":
      return "Changed permissions";
    default:
      return activity.action
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase())
        .replace(/Api/g, "API")
        .replace(/Id\b/g, "ID")
        .replace(/Url\b/g, "URL");
  }
};

const getDeviceIcon = (userAgent: string) => {
  if (
    userAgent.toLowerCase().includes("mobile") ||
    userAgent.toLowerCase().includes("iphone") ||
    userAgent.toLowerCase().includes("android")
  ) {
    return <Smartphone className="h-4 w-4" />;
  }
  return <Monitor className="h-4 w-4" />;
};

const renderMetadataValue = (value: any): string => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
};

const formatMetadataKey = (key: string): string => {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

export function ActivityHistory() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;

  // Calculate total pages based on server-side total count
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Filter activities client-side for display (search/filter happens on fetched page)
  const filteredActivities = useMemo(() => {
    let filtered = activities;

    if (searchTerm) {
      filtered = filtered.filter(
        (activity) =>
          getActivityDescription(activity)
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          activity.ipAddress?.includes(searchTerm) ||
          activity.action.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    if (actionFilter !== "all") {
      filtered = filtered.filter((activity) =>
        activity.action.includes(actionFilter),
      );
    }

    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter((activity) => {
        const activityDate = new Date(activity.timestamp);
        if (dateRange.from && dateRange.to) {
          return isWithinInterval(activityDate, {
            start: startOfDay(dateRange.from),
            end: endOfDay(dateRange.to),
          });
        } else if (dateRange.from) {
          return activityDate >= startOfDay(dateRange.from);
        } else if (dateRange.to) {
          return activityDate <= endOfDay(dateRange.to);
        }
        return true;
      });
    }

    return filtered;
  }, [activities, searchTerm, actionFilter, dateRange]);

  // Fetch activities with pagination
  const fetchActivities = async (page: number = currentPage) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/profile/activity", {
        params: { page, limit: itemsPerPage },
      });
      setActivities(response.data.activities || []);
      setTotalCount(response.data.pagination?.total || 0);
    } catch (error) {
      console.error("Failed to fetch activities:", error);
      setError(
        error instanceof Error ? error.message : "Failed to fetch activities",
      );
      setActivities([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch activities on component mount
  useEffect(() => {
    fetchActivities(1);
  }, []);

  // Fetch activities when page changes
  useEffect(() => {
    fetchActivities(currentPage);
  }, [currentPage]);

  const refreshActivities = async () => {
    await fetchActivities(currentPage);
  };

  const toggleRowExpanded = (id: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const uniqueActions = Array.from(
    new Set(activities.map((a) => a.action.split("_")[0])),
  );

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Unable to Load Activity History
            </h3>
            <p className="text-muted-foreground text-center mb-4">{error}</p>
            <Button onClick={refreshActivities} disabled={isLoading}>
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-col lg:flex-row gap-2">
          {/* Search and Action Filter Row */}
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 input-enhanced"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-[180px] select-enhanced">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent className="select-content-enhanced">
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action.charAt(0).toUpperCase() + action.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range and Refresh Row */}
          <div className="flex gap-2">
            <DatePickerWithRange
              date={dateRange}
              onDateChange={setDateRange}
              className="flex-1 lg:w-[260px]"
            />
            {(dateRange.from || dateRange.to) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDateRange({ from: undefined, to: undefined })}
                className="h-9 w-9 flex-shrink-0"
                title="Clear dates"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              onClick={refreshActivities}
              disabled={isLoading}
              size="icon"
              className="h-9 w-9 flex-shrink-0 button-enhanced"
              title="Refresh"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div className="space-y-2">
        {filteredActivities.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No activities found
              </h3>
              <p className="text-muted-foreground text-center">
                {searchTerm || actionFilter !== "all"
                  ? "Try adjusting your search or filter criteria."
                  : "Your activity history will appear here."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="divide-y divide-border">
              {filteredActivities.map((activity) => (
                <Collapsible
                  key={activity.id}
                  open={expandedRows.has(activity.id)}
                  onOpenChange={() => toggleRowExpanded(activity.id)}
                >
                  <div className="hover:bg-muted/50 transition-colors">
                    <CollapsibleTrigger asChild>
                      <button className="w-full text-left p-4 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset">
                        <div className="flex items-center gap-3">
                          {/* Status Icon */}
                          <div
                            className={`p-1.5 rounded ${
                              activity.success
                                ? "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                                : "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                            }`}
                          >
                            {getActivityIcon(activity.action, "h-3 w-3")}
                          </div>

                          {/* Main Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {/* High importance indicator */}
                              {activity.metadata?.importance === "high" && (
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                              )}
                              <span className="font-medium text-sm truncate">
                                {getActivityDescription(activity)}
                              </span>
                              {activity.success ? (
                                <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 flex-shrink-0" />
                              )}
                            </div>
                          </div>

                          {/* Right side info */}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="hidden sm:flex items-center gap-1">
                              {getDeviceIcon(activity.userAgent || "")}
                            </div>
                            {activity.ipAddress && (
                              <span className="hidden md:block">
                                {activity.ipAddress}
                              </span>
                            )}
                            <span className="text-right min-w-[100px]">
                              {formatDistanceToNow(
                                new Date(activity.timestamp),
                                { addSuffix: true },
                              )}
                            </span>
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${
                                expandedRows.has(activity.id)
                                  ? "rotate-180"
                                  : ""
                              }`}
                            />
                          </div>
                        </div>
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-4 pb-4 pt-2 space-y-3">
                        {/* Full details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Time:</span>
                            <span className="ml-2">
                              {format(new Date(activity.timestamp), "PPpp")}
                            </span>
                          </div>
                          {activity.ipAddress && (
                            <div>
                              <span className="text-muted-foreground">
                                IP Address:
                              </span>
                              <span className="ml-2">{activity.ipAddress}</span>
                            </div>
                          )}
                          {activity.userAgent && (
                            <div className="sm:col-span-2">
                              <span className="text-muted-foreground">
                                Device:
                              </span>
                              <span className="ml-2 text-xs">
                                {activity.userAgent}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Metadata */}
                        {activity.metadata &&
                          Object.keys(activity.metadata).length > 0 && (
                            <div className="bg-muted/30 rounded-md p-3">
                              <h5 className="text-xs font-semibold mb-2">
                                Additional Details
                              </h5>
                              <div className="space-y-1">
                                {Object.entries(activity.metadata).map(
                                  ([key, value]) => (
                                    <div key={key} className="text-xs">
                                      <span className="text-muted-foreground">
                                        {formatMetadataKey(key)}:
                                      </span>
                                      <span className="ml-2 break-all">
                                        {renderMetadataValue(value)}
                                      </span>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          )}

                        {/* Error details */}
                        {!activity.success && activity.errorMessage && (
                          <div className="bg-red-50 dark:bg-red-900/20 rounded-md p-3">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                              <div>
                                <h5 className="text-xs font-semibold text-red-900 dark:text-red-200 mb-1">
                                  Error Details
                                </h5>
                                <p className="text-xs text-red-700 dark:text-red-300">
                                  {activity.errorMessage}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount}{" "}
            activities
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={i}
                    variant={pageNum === currentPage ? "default" : "outline"}
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
