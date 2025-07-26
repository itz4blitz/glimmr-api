import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Shield,
  Mail,
  Calendar,
  Activity,
  Building,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { UserListItem } from "@/types/userManagement";
import type { UserRole } from "@/types/auth";

interface UserCardListProps {
  users: UserListItem[];
  selectedUsers: string[];
  onUserSelect: (userId: string, selected: boolean) => void;
  onUserAction: (userId: string, action: string) => void;
  onUserClick: (userId: string) => void;
  isLoading?: boolean;
}

function UserCard({
  user,
  isSelected,
  onSelect,
  onAction,
  onClick,
}: {
  user: UserListItem;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onAction: (action: string) => void;
  onClick: () => void;
}) {
  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case "admin":
        return "default";
      case "super_admin":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header with checkbox and actions */}
          <div className="flex items-center justify-between">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select ${user.email}`}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onAction("edit")}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit User
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {user.isActive ? (
                  <DropdownMenuItem onClick={() => onAction("deactivate")}>
                    <UserX className="mr-2 h-4 w-4" />
                    Deactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onAction("activate")}>
                    <UserCheck className="mr-2 h-4 w-4" />
                    Activate
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onAction("delete")}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete User
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* User info */}
          <div className="flex items-start gap-3" onClick={onClick}>
            <UserAvatar
              src={user.profile?.avatarUrl}
              alt={user.email}
              email={user.email}
              firstName={user.firstName}
              lastName={user.lastName}
              size="md"
            />

            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {user.firstName && user.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user.email}
              </div>
              <div className="text-sm text-muted-foreground truncate">
                {user.email}
              </div>

              {/* Company and job title */}
              {(user.profile?.company || user.profile?.jobTitle) && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Building className="h-3 w-3" />
                  <span className="truncate">
                    {user.profile.company}
                    {user.profile.company && user.profile.jobTitle && " • "}
                    {user.profile.jobTitle}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant={getRoleBadgeVariant(user.role)}>
              <Shield className="h-3 w-3 mr-1" />
              {user.role.replace("_", " ").toUpperCase()}
            </Badge>

            <Badge variant={user.isActive ? "default" : "secondary"}>
              {user.isActive ? "Active" : "Inactive"}
            </Badge>

            {!user.emailVerified && (
              <Badge variant="outline" className="text-orange-600">
                <Mail className="h-3 w-3 mr-1" />
                Unverified
              </Badge>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              <span>{user.activityCount || 0} activities</span>
            </div>

            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>
                {user.lastLoginAt
                  ? formatDistanceToNow(new Date(user.lastLoginAt), {
                      addSuffix: true,
                    })
                  : "Never logged in"}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function UserCardList({
  users,
  selectedUsers,
  onUserSelect,
  onUserAction,
  onUserClick,
  isLoading,
}: UserCardListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                  <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 bg-muted rounded-full animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded animate-pulse" />
                    <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                  <div className="h-6 w-12 bg-muted rounded animate-pulse" />
                </div>
                <div className="flex justify-between">
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-muted-foreground">
            No users found matching your criteria.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {users.map((user) => (
        <UserCard
          key={user.id}
          user={user}
          isSelected={selectedUsers.includes(user.id)}
          onSelect={(selected) => onUserSelect(user.id, selected)}
          onAction={(action) => onUserAction(user.id, action)}
          onClick={() => onUserClick(user.id)}
        />
      ))}
    </div>
  );
}
