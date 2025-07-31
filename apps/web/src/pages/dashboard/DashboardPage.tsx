import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Settings,
  Shield,
  TrendingUp,
  FileText,
  Activity,
  Users,
  Building2,
  DollarSign,
  Database,
} from "lucide-react";
import { getRoleDisplayName, isAdmin } from "@/lib/permissions";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

interface DashboardStats {
  hospitals: {
    total: number;
    active: number;
    withPrices: number;
  };
  prices: {
    total: number;
    lastUpdated: string | null;
  };
  files: {
    totalFiles: number;
    totalSize: number;
    pendingDownloads: number;
  };
}

export function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardStats = async () => {
    try {
      const response = await apiClient.get("/dashboard/stats");
      setStats(response.data);
    } catch (error) {
      // Check if it's a 404 or other expected error
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        // Dashboard stats endpoint not available yet, use defaults
        setStats({
          hospitals: { total: 0, active: 0, withPrices: 0 },
          prices: { total: 0, lastUpdated: null },
          files: { totalFiles: 0, totalSize: 0, pendingDownloads: 0 },
        });
      } else {
        // Log unexpected errors but still show the dashboard
        console.error("Failed to fetch dashboard stats:", error);
        toast.error("Unable to load dashboard statistics. Some data may be unavailable.");
        
        // Still set default values to allow dashboard to render
        setStats({
          hospitals: { total: 0, active: 0, withPrices: 0 },
          prices: { total: 0, lastUpdated: null },
          files: { totalFiles: 0, totalSize: 0, pendingDownloads: 0 },
        });
      }
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    fetchDashboardStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchDashboardStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (diffMs < 60000) return "Just now";
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
    return `${Math.floor(diffMs / 86400000)}d ago`;
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {user?.email}!
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Total Hospitals
                    </p>
                    <p className="text-2xl font-bold">
                      {isLoading
                        ? "-"
                        : stats?.hospitals.total.toLocaleString() || "0"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats?.hospitals.active || 0} active
                    </p>
                  </div>
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Price Records
                    </p>
                    <p className="text-2xl font-bold">
                      {isLoading
                        ? "-"
                        : stats?.prices.total.toLocaleString() || "0"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Updated {formatTimeAgo(stats?.prices.lastUpdated || null)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </motion.div>


          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.3 }}
          >
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Data Files
                    </p>
                    <p className="text-2xl font-bold">
                      {isLoading
                        ? "-"
                        : stats?.files.totalFiles.toLocaleString() || "0"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatFileSize(stats?.files.totalSize || 0)}
                    </p>
                  </div>
                  <Database className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* User Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            className="lg:col-span-2"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  User Information
                </CardTitle>
                <CardDescription>
                  Your account details and role information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Email
                    </label>
                    <p className="text-foreground break-all">{user?.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      User ID
                    </label>
                    <p className="text-foreground font-mono text-sm">
                      {user?.id}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Role
                    </label>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          user?.role === "super_admin"
                            ? "default"
                            : user?.role === "admin"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        {user?.role ? getRoleDisplayName(user.role) : "Unknown"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Status
                    </label>
                    <Badge variant={user?.isActive ? "default" : "destructive"}>
                      {user?.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>Common tasks and navigation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <Button
                  variant="outline"
                  className="h-16 sm:h-20 flex-col justify-center"
                  onClick={() => navigate("/profile")}
                >
                  <User className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                  <span className="text-xs sm:text-sm">Profile Settings</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-16 sm:h-20 flex-col justify-center"
                  onClick={() => navigate("/hospitals")}
                >
                  <Building2 className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                  <span className="text-xs sm:text-sm">Browse Hospitals</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-16 sm:h-20 flex-col justify-center"
                  onClick={() => navigate("/prices")}
                >
                  <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                  <span className="text-xs sm:text-sm">Price Data</span>
                </Button>

                {user && isAdmin(user.role) && (
                  <>
                    <Button
                      variant="outline"
                      className="h-16 sm:h-20 flex-col justify-center"
                      onClick={() => navigate("/admin/users")}
                    >
                      <Users className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                      <span className="text-xs sm:text-sm">
                        User Management
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-16 sm:h-20 flex-col justify-center"
                      onClick={() => navigate("/admin/settings")}
                    >
                      <Settings className="h-5 w-5 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                      <span className="text-xs sm:text-sm">Admin Panel</span>
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Welcome Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.3 }}
          className="mt-6 sm:mt-8"
        >
          <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
            <CardContent className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-2">
                Welcome to Glimmr!
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Your healthcare price transparency platform is ready to use.
                {stats && stats.hospitals.total === 0 && (
                  <span className="block mt-2 font-medium">
                    Get started by running a PRA Hospital Scan to import
                    hospital data.
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
