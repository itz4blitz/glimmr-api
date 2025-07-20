import { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  Download, 
  Upload,
  BarChart3,
  UserCheck,
  UserX,
  Shield,
  Settings,
  MoreHorizontal
} from 'lucide-react'
import { UserList } from '@/components/admin/UserList'
import { UserStats } from '@/components/admin/UserStats'
import { UserFilters } from '@/components/admin/UserFilters'
import { UserBulkActions } from '@/components/admin/UserBulkActions'
import { CreateUserDialog } from '@/components/admin/CreateUserDialog'

export function UserManagementPage() {
  const [activeTab, setActiveTab] = useState('users')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [filters, setFilters] = useState({
    role: 'all',
    status: 'all',
    emailVerified: 'all',
    dateRange: 'all',
  })
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const handleUserSelect = (userId: string, selected: boolean) => {
    if (selected) {
      setSelectedUsers(prev => [...prev, userId])
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId))
    }
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      // In a real app, you'd get all user IDs from the current page/filter
      setSelectedUsers(['user1', 'user2', 'user3']) // Mock data
    } else {
      setSelectedUsers([])
    }
  }

  const handleBulkAction = (action: string) => {
    console.log('Bulk action:', action, 'for users:', selectedUsers)
    // Here you would implement the bulk action logic
    setSelectedUsers([])
  }

  const handleExportUsers = () => {
    console.log('Exporting users with filters:', filters)
    // Here you would implement the export logic
  }

  const handleImportUsers = () => {
    console.log('Importing users')
    // Here you would implement the import logic
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8" />
              User Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage users, roles, and permissions across your organization
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleImportUsers}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button variant="outline" onClick={handleExportUsers}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            {/* Search and Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users by name, email, or role..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Quick Filters */}
                  <div className="flex flex-wrap gap-2">
                    <Select value={filters.role} onValueChange={(value) => setFilters(prev => ({ ...prev, role: value }))}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>

                    <UserFilters filters={filters} onFiltersChange={setFilters} />
                  </div>
                </div>

                {/* Bulk Actions */}
                {selectedUsers.length > 0 && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <UserBulkActions
                      selectedCount={selectedUsers.length}
                      onAction={handleBulkAction}
                      onClear={() => setSelectedUsers([])}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* User List */}
            <UserList
              searchTerm={searchTerm}
              filters={filters}
              selectedUsers={selectedUsers}
              onUserSelect={handleUserSelect}
              onSelectAll={handleSelectAll}
            />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <UserStats />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>User Management Settings</CardTitle>
                <CardDescription>
                  Configure user registration, permissions, and security settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Registration Settings */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Registration Settings</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Allow Self Registration</p>
                          <p className="text-sm text-muted-foreground">
                            Allow users to register for accounts without admin approval
                          </p>
                        </div>
                        <Badge variant="secondary">Disabled</Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Email Verification Required</p>
                          <p className="text-sm text-muted-foreground">
                            Require email verification before account activation
                          </p>
                        </div>
                        <Badge variant="default">Enabled</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Security Settings */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4">Security Settings</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Password Complexity</p>
                          <p className="text-sm text-muted-foreground">
                            Minimum 8 characters with mixed case and numbers
                          </p>
                        </div>
                        <Badge variant="default">Enabled</Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Two-Factor Authentication</p>
                          <p className="text-sm text-muted-foreground">
                            Allow users to enable 2FA for enhanced security
                          </p>
                        </div>
                        <Badge variant="default">Available</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Session Settings */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4">Session Settings</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Session Timeout</p>
                          <p className="text-sm text-muted-foreground">
                            Automatic logout after 24 hours of inactivity
                          </p>
                        </div>
                        <Badge variant="secondary">24 hours</Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Concurrent Sessions</p>
                          <p className="text-sm text-muted-foreground">
                            Maximum number of active sessions per user
                          </p>
                        </div>
                        <Badge variant="secondary">5 sessions</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create User Dialog */}
        <CreateUserDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
        />
      </div>
    </AppLayout>
  )
}
