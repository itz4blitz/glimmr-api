import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatar } from "@/components/ui/user-avatar";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Shield,
  Mail,
  Calendar,
  Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { User, UserRole } from "@/types/auth";

interface UserTableRowProps {
  user: User;
  index: number;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onClick: () => void;
  onAction: (action: string) => void;
}

export function UserTableRow({
  user,
  index,
  isSelected,
  onSelect,
  onClick,
  onAction,
}: UserTableRowProps) {
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
    <TableRow
      className={`cursor-pointer hover:bg-gradient-to-r hover:from-primary/5 hover:to-primary/10 hover:shadow-sm transition-all duration-200 border-b border-border/10 group ${
        index % 2 === 0 ? "bg-background/80" : "bg-muted/10"
      }`}
      onClick={onClick}
    >
      <TableCell className="py-5 px-6" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          aria-label={`Select ${user.email}`}
        />
      </TableCell>
      <TableCell className="py-5 px-6">
        <div className="flex items-center gap-3">
          <UserAvatar
            src={user.profile?.avatarUrl}
            alt={user.email}
            email={user.email}
            firstName={user.firstName}
            lastName={user.lastName}
            size="sm"
          />
          <div>
            <div className="font-medium">
              {user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.email}
            </div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
            {user.profile?.company && (
              <div className="text-xs text-muted-foreground">
                {user.profile.company}
                {user.profile.jobTitle && ` • ${user.profile.jobTitle}`}
              </div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="py-5 px-6">
        <Badge
          variant={getRoleBadgeVariant(user.role || "user")}
          className="shadow-sm"
        >
          <Shield className="h-3 w-3 mr-1" />
          {user.role?.replace("_", " ").toUpperCase() || "USER"}
        </Badge>
      </TableCell>
      <TableCell className="py-5 px-6">
        <div className="flex flex-col gap-1">
          <Badge
            variant={user.isActive ? "default" : "secondary"}
            className="shadow-sm"
          >
            {user.isActive ? "Active" : "Inactive"}
          </Badge>
          {!user.emailVerified && (
            <Badge variant="outline" className="text-xs shadow-sm">
              <Mail className="h-3 w-3 mr-1" />
              Unverified
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="py-5 px-6">
        <div className="text-sm font-medium">
          {user.lastLoginAt && !isNaN(new Date(user.lastLoginAt).getTime()) ? (
            <div className="flex items-center gap-2 text-foreground/80">
              <Calendar className="h-4 w-4 text-primary/60" />
              {formatDistanceToNow(new Date(user.lastLoginAt), {
                addSuffix: true,
              })}
            </div>
          ) : (
            <span className="text-muted-foreground">Never</span>
          )}
        </div>
      </TableCell>
      <TableCell className="py-5 px-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4 text-primary/60" />
          <span className="text-foreground/80">{user.activityCount || 0}</span>
        </div>
      </TableCell>
      <TableCell className="py-5 px-6" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
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
      </TableCell>
    </TableRow>
  );
}
