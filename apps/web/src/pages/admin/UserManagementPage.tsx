import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { UnsavedChangesProvider } from "@/contexts/UnsavedChangesContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Search,
  Filter,
  Plus,
  Download,
  BarChart3,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import { UserList } from "@/components/admin/UserList";
import { UserCardList } from "@/components/admin/UserCardList";
import { UserStats } from "@/components/admin/UserStats";

import { UserBulkActions } from "@/components/admin/UserBulkActions";
import { AdvancedFiltersDialog } from "@/components/admin/AdvancedFiltersDialog";
import { MobileFiltersDrawer } from "@/components/admin/MobileFiltersDrawer";
import { ExportDialog } from "@/components/admin/ExportDialog";
import { UserDetailDialog } from "@/components/admin/UserDetailDialog";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { useUserManagementStore } from "@/stores/userManagement";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type {
  UserFilters as UserFiltersType,
  AdvancedFilters,
} from "@/types/userManagement";

function UserManagementPageContent() {
  const [activeTab, setActiveTab] = useState("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    roles: [],
    statuses: [],
    emailVerified: null,
    dateRange: {
      field: "createdAt",
      start: null,
      end: null,
    },
    hasActivity: null,
    hasFiles: null,
  });

  const isMobile = useMediaQuery("(max-width: 768px)");

  const {
    users,
    loading,
    filters,
    selectedUserIds,
    setFilters,
    resetFilters,
    loadUsers,
    loadUserStats,
    selectUser,
    deselectUser,
    clearSelection,
  } = useUserManagementStore();

  // Load initial data
  useEffect(() => {
    loadUsers();
    loadUserStats();
  }, [loadUsers, loadUserStats]);

  // Update search term in store with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters({ search: searchTerm });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, setFilters]);

  const handleUserSelect = (userId: string, selected: boolean) => {
    if (selected) {
      selectUser(userId);
    } else {
      deselectUser(userId);
    }
  };

  const handleUserAction = (userId: string) => {
    setSelectedUserId(userId);
  };

  const handleUserClick = (userId: string) => {
    setSelectedUserId(userId);
  };

  const handleFilterChange = (key: keyof UserFiltersType, value: string) => {
    setFilters({ [key]: value });
  };

  const handleAdvancedFiltersChange = (newFilters: AdvancedFilters) => {
    setAdvancedFilters(newFilters);
    // Convert advanced filters to basic filters for the store
    setFilters({ advanced: newFilters });
  };

  const clearFilters = () => {
    resetFilters();
    setSearchTerm("");
    setAdvancedFilters({
      roles: [],
      statuses: [],
      emailVerified: null,
      dateRange: {
        field: "createdAt",
        start: null,
        end: null,
      },
      hasActivity: null,
      hasFiles: null,
    });
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <Card className="border border-border/50">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                      <Users className="h-6 w-6 sm:h-8 sm:w-8" />
                      User Management
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                      Manage users, roles, and permissions across your
                      organization
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <ExportDialog>
                      <Button
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">Export</span>
                      </Button>
                    </ExportDialog>
                    <Button
                      onClick={() => setIsCreateDialogOpen(true)}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      <span className="hidden sm:inline">Add User</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-6 sm:space-y-8"
          >
            <TabsList className="tabs-list-enhanced grid w-full grid-cols-3 h-auto p-1.5">
              <TabsTrigger
                value="users"
                className="tabs-trigger-enhanced flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-3 px-3"
              >
                <Users className="h-4 w-4" />
                <span className="text-xs sm:text-sm font-medium">Users</span>
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="tabs-trigger-enhanced flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-3 px-3"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="text-xs sm:text-sm font-medium">
                  Analytics
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="tabs-trigger-enhanced flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-3 px-3"
              >
                <Settings className="h-4 w-4" />
                <span className="text-xs sm:text-sm font-medium">Settings</span>
              </TabsTrigger>
            </TabsList>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-4 sm:space-y-6">
              {/* User List with Integrated Filters */}
              <div className="bg-gradient-to-br from-background to-muted/20 rounded-xl shadow-2xl border border-border/20 overflow-hidden">
                {/* Header with Filters */}
                <div className="px-6 py-6 bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border/30">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-foreground">
                      Users ({users.length})
                    </h2>
                  </div>

                  {/* Search and Filters */}
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Search */}
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search users by name, email, or role..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 input-enhanced"
                      />
                    </div>

                    {/* Quick Filters */}
                    <div className="flex flex-wrap gap-3">
                      <Select
                        value={filters.role}
                        onValueChange={(value) =>
                          handleFilterChange("role", value)
                        }
                      >
                        <SelectTrigger className="w-[140px] input-enhanced">
                          <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="super_admin">
                            Super Admin
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={filters.status}
                        onValueChange={(value) =>
                          handleFilterChange("status", value)
                        }
                      >
                        <SelectTrigger className="w-[140px] input-enhanced">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Advanced Filters - Desktop */}
                      {!isMobile && (
                        <AdvancedFiltersDialog
                          filters={advancedFilters}
                          onFiltersChange={handleAdvancedFiltersChange}
                        >
                          <Button variant="outline" className="input-enhanced">
                            <SlidersHorizontal className="h-4 w-4 mr-2" />
                            Advanced
                          </Button>
                        </AdvancedFiltersDialog>
                      )}

                      {/* Mobile Filters */}
                      {isMobile && (
                        <MobileFiltersDrawer
                          filters={filters}
                          onFiltersChange={setFilters}
                          onReset={clearFilters}
                        >
                          <Button variant="outline" className="input-enhanced">
                            <Filter className="h-4 w-4 mr-2" />
                            Filters
                          </Button>
                        </MobileFiltersDrawer>
                      )}
                    </div>
                  </div>

                  {/* Bulk Actions */}
                  {selectedUserIds.length > 0 && (
                    <div className="mt-4 p-4 bg-background/80 rounded-lg border border-border/20">
                      <UserBulkActions
                        selectedUserIds={selectedUserIds}
                        onClear={clearSelection}
                      />
                    </div>
                  )}
                </div>

                {/* User List Content */}
                {isMobile ? (
                  <div className="bg-background/95 backdrop-blur-sm">
                    <UserCardList
                      users={users}
                      selectedUsers={selectedUserIds}
                      onUserSelect={handleUserSelect}
                      onUserAction={handleUserAction}
                      onUserClick={handleUserClick}
                      isLoading={loading.users}
                    />
                  </div>
                ) : (
                  <UserList
                    selectedUsers={selectedUserIds}
                    onUserSelect={handleUserSelect}
                    onUserEdit={handleUserAction}
                  />
                )}
              </div>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-4 sm:space-y-6">
              <UserStats />
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4 sm:space-y-6">
              <Card className="border-2 border-border/50">
                <CardHeader className="px-6 py-6">
                  <CardTitle className="text-xl">
                    User Management Settings
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Configure user registration, permissions, and security
                    settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <div className="space-y-6">
                    {/* Registration Settings */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">
                        Registration Settings
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              Allow Self Registration
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Allow users to register for accounts without admin
                              approval
                            </p>
                          </div>
                          <Badge variant="secondary">Disabled</Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              Email Verification Required
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Require email verification before account
                              activation
                            </p>
                          </div>
                          <Badge variant="default">Enabled</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Security Settings */}
                    <div className="border-t pt-6">
                      <h3 className="text-lg font-semibold mb-4">
                        Security Settings
                      </h3>
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
                            <p className="font-medium">
                              Two-Factor Authentication
                            </p>
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
                      <h3 className="text-lg font-semibold mb-4">
                        Session Settings
                      </h3>
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

          {/* User Detail Dialog */}
          {selectedUserId && (
            <UserDetailDialog
              userId={selectedUserId}
              open={!!selectedUserId}
              onOpenChange={(open) => !open && setSelectedUserId(null)}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export function UserManagementPage() {
  return (
    <UnsavedChangesProvider>
      <UserManagementPageContent />
    </UnsavedChangesProvider>
  );
}
