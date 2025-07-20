import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Users, 
  UserCheck, 
  UserX, 
  Shield, 
  Mail, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Activity
} from 'lucide-react'

interface UserStatsData {
  totalUsers: number
  activeUsers: number
  inactiveUsers: number
  verifiedUsers: number
  unverifiedUsers: number
  adminUsers: number
  regularUsers: number
  newUsersThisMonth: number
  newUsersThisWeek: number
}

// Mock stats data
const mockStats: UserStatsData = {
  totalUsers: 1247,
  activeUsers: 1156,
  inactiveUsers: 91,
  verifiedUsers: 1198,
  unverifiedUsers: 49,
  adminUsers: 12,
  regularUsers: 1235,
  newUsersThisMonth: 87,
  newUsersThisWeek: 23,
}

interface StatCardProps {
  title: string
  value: number
  description: string
  icon: React.ReactNode
  trend?: {
    value: number
    isPositive: boolean
    period: string
  }
  badge?: {
    text: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
  }
}

function StatCard({ title, value, description, icon, trend, badge }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {badge && (
            <Badge variant={badge.variant} className="text-xs">
              {badge.text}
            </Badge>
          )}
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {trend && (
          <div className="flex items-center pt-1">
            {trend.isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span className={`text-xs ml-1 ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {trend.isPositive ? '+' : ''}{trend.value}% {trend.period}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function UserStats() {
  const [stats, setStats] = useState<UserStatsData>(mockStats)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Here you would fetch real stats from your API
    const fetchStats = async () => {
      setIsLoading(true)
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        setStats(mockStats)
      } catch (error) {
        console.error('Failed to fetch user stats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  const activePercentage = Math.round((stats.activeUsers / stats.totalUsers) * 100)
  const verifiedPercentage = Math.round((stats.verifiedUsers / stats.totalUsers) * 100)
  const adminPercentage = Math.round((stats.adminUsers / stats.totalUsers) * 100)

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          description="All registered users"
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          trend={{
            value: 12,
            isPositive: true,
            period: "from last month"
          }}
        />

        <StatCard
          title="Active Users"
          value={stats.activeUsers}
          description={`${activePercentage}% of total users`}
          icon={<UserCheck className="h-4 w-4 text-green-500" />}
          badge={{
            text: `${activePercentage}%`,
            variant: activePercentage > 90 ? 'default' : 'secondary'
          }}
        />

        <StatCard
          title="Verified Users"
          value={stats.verifiedUsers}
          description={`${verifiedPercentage}% email verified`}
          icon={<Mail className="h-4 w-4 text-blue-500" />}
          badge={{
            text: `${verifiedPercentage}%`,
            variant: verifiedPercentage > 95 ? 'default' : 'secondary'
          }}
        />

        <StatCard
          title="Admin Users"
          value={stats.adminUsers}
          description={`${adminPercentage}% of total users`}
          icon={<Shield className="h-4 w-4 text-purple-500" />}
          badge={{
            text: `${adminPercentage}%`,
            variant: 'outline'
          }}
        />
      </div>

      {/* Detailed Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* User Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              User Status Breakdown
            </CardTitle>
            <CardDescription>
              Distribution of active and inactive users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Active Users</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{stats.activeUsers.toLocaleString()}</span>
                <Badge variant="default">{activePercentage}%</Badge>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium">Inactive Users</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{stats.inactiveUsers.toLocaleString()}</span>
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Verification Status
            </CardTitle>
            <CardDescription>
              Email verification completion rates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Verified</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{stats.verifiedUsers.toLocaleString()}</span>
                <Badge variant="default">{verifiedPercentage}%</Badge>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Unverified</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{stats.unverifiedUsers.toLocaleString()}</span>
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
              {Math.round((stats.newUsersThisWeek / stats.totalUsers) * 100 * 100) / 100}% of total users
            </p>
            <div className="flex items-center pt-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs ml-1 text-green-500">+15% from last week</span>
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
              {Math.round((stats.newUsersThisMonth / stats.totalUsers) * 100 * 100) / 100}% of total users
            </p>
            <div className="flex items-center pt-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs ml-1 text-green-500">+8% from last month</span>
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
  )
}
