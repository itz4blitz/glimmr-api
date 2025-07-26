import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  UserCheck,
  UserX,
  Shield,
  Mail,
  TrendingUp,
  TrendingDown,
  Calendar,
  Activity,
  AlertTriangle,
} from "lucide-react";

interface UserStatsData {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  verifiedUsers: number;
  unverifiedUsers: number;
  adminUsers: number;
  regularUsers: number;
  newUsersThisMonth: number;
  newUsersThisWeek: number;
}

interface StatCardProps {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    period: string;
  };
  badge?: {
    text: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  };
}

function StatCard({
  title,
  value,
  description,
  icon,
  trend,
  badge,
}: StatCardProps) {
  return (
    <div className="bg-gradient-to-br from-background to-muted/20 rounded-xl shadow-2xl border border-border/20 overflow-hidden group hover:shadow-3xl transition-all duration-300">
      <div className="px-6 py-4 bg-gradient-to-r from-muted/30 to-muted/20 border-b border-border/20">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {title}
          </h3>
          <div className="flex items-center gap-2">
            {badge && (
              <Badge variant={badge.variant} className="text-xs shadow-sm">
                {badge.text}
              </Badge>
            )}
            <div className="p-2 bg-background/80 rounded-lg shadow-sm">
              {icon}
            </div>
          </div>
        </div>
      </div>
      <div className="px-6 py-6 bg-background/95 backdrop-blur-sm">
        <div className="text-3xl font-bold text-foreground mb-2">
          {value.toLocaleString()}
        </div>
        <p className="text-sm text-muted-foreground font-medium mb-3">
          {description}
        </p>
        {trend && (
          <div className="flex items-center gap-1 px-3 py-1 bg-background/80 rounded-full w-fit">
            {trend.isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span
              className={`text-sm font-medium ${trend.isPositive ? "text-green-500" : "text-red-500"}`}
            >
              {trend.isPositive ? "+" : ""}
              {trend.value}% {trend.period}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function UserStats() {
  const [stats, setStats] = useState<UserStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch real stats from API
        const response = await fetch("/api/v1/users/stats");
        if (!response.ok) {
          throw new Error(`Failed to fetch user stats: ${response.status}`);
        }
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch user stats:", error);
        setError(error instanceof Error ? error.message : "An error occurred");
        setStats(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Unable to Load User Statistics
            </h3>
            <p className="text-muted-foreground text-center">
              {error || "Failed to fetch user statistics from the API"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activePercentage = Math.round(
    (stats.activeUsers / stats.totalUsers) * 100,
  );
  const verifiedPercentage = Math.round(
    (stats.verifiedUsers / stats.totalUsers) * 100,
  );
  const adminPercentage = Math.round(
    (stats.adminUsers / stats.totalUsers) * 100,
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Overview Stats */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          description="All registered users"
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          trend={{
            value: 12,
            isPositive: true,
            period: "from last month",
          }}
        />

        <StatCard
          title="Active Users"
          value={stats.activeUsers}
          description={`${activePercentage}% of total users`}
          icon={<UserCheck className="h-4 w-4 text-green-500" />}
          badge={{
            text: `${activePercentage}%`,
            variant: activePercentage > 90 ? "default" : "secondary",
          }}
        />

        <StatCard
          title="Verified Users"
          value={stats.verifiedUsers}
          description={`${verifiedPercentage}% email verified`}
          icon={<Mail className="h-4 w-4 text-blue-500" />}
          badge={{
            text: `${verifiedPercentage}%`,
            variant: verifiedPercentage > 95 ? "default" : "secondary",
          }}
        />

        <StatCard
          title="Admin Users"
          value={stats.adminUsers}
          description={`${adminPercentage}% of total users`}
          icon={<Shield className="h-4 w-4 text-purple-500" />}
          badge={{
            text: `${adminPercentage}%`,
            variant: "outline",
          }}
        />
      </div>

      {/* Detailed Breakdown */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
        {/* User Status Breakdown */}
        <Card className="border-2 border-border/50">
          <CardHeader className="px-6 py-6">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Activity className="h-5 w-5" />
              User Status Breakdown
            </CardTitle>
            <CardDescription className="text-sm">
              Distribution of active and inactive users
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Active Users</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">
                  {stats.activeUsers.toLocaleString()}
                </span>
                <Badge variant="default">{activePercentage}%</Badge>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium">Inactive Users</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">
                  {stats.inactiveUsers.toLocaleString()}
                </span>
                <Badge variant="secondary">{100 - activePercentage}%</Badge>
              </div>
            </div>

            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{ width: `${activePercentage}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>

        {/* Email Verification Breakdown */}
        <Card className="border-2 border-border/50">
          <CardHeader className="px-6 py-6">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Mail className="h-5 w-5" />
              Email Verification Status
            </CardTitle>
            <CardDescription className="text-sm">
              Email verification completion rates
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Verified</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">
                  {stats.verifiedUsers.toLocaleString()}
                </span>
                <Badge variant="default">{verifiedPercentage}%</Badge>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Unverified</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">
                  {stats.unverifiedUsers.toLocaleString()}
                </span>
                <Badge variant="destructive">{100 - verifiedPercentage}%</Badge>
              </div>
            </div>

            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{ width: `${verifiedPercentage}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Growth Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              New Users This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newUsersThisWeek}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round(
                (stats.newUsersThisWeek / stats.totalUsers) * 100 * 100,
              ) / 100}
              % of total users
            </p>
            <div className="flex items-center pt-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs ml-1 text-green-500">
                +15% from last week
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              New Users This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newUsersThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round(
                (stats.newUsersThisMonth / stats.totalUsers) * 100 * 100,
              ) / 100}
              % of total users
            </p>
            <div className="flex items-center pt-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs ml-1 text-green-500">
                +8% from last month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Role Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Regular Users</span>
                <span className="font-medium">{stats.regularUsers}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Administrators</span>
                <span className="font-medium">{stats.adminUsers}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${100 - adminPercentage}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
