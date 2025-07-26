import { useLocation } from "react-router-dom";
import { useNavigation } from "@/hooks/useNavigation";
import {
  Home,
  User,
  Settings,
  
  BarChart3,
  Users,
  Database,
  FileText,
  Activity,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useSidebarStore } from "@/stores/sidebar";
import { isAdmin, isSuperAdmin } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Sidebar() {
  const { user } = useAuthStore();
  const { isCollapsed, toggleSidebar } = useSidebarStore();
  const { isPending } = useNavigation();
  const location = useLocation();

  const navigation = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: Home,
      description: "Overview and quick actions",
    },
    {
      name: "Profile",
      href: "/profile",
      icon: User,
      description: "Manage your account",
    },
    {
      name: "Analytics",
      href: "/analytics",
      icon: BarChart3,
      description: "View reports and insights",
      badge: "New",
    },
    {
      name: "Documents",
      href: "/documents",
      icon: FileText,
      description: "Manage your files",
    },
  ];

  const adminNavigation = [
    {
      name: "User Management",
      href: "/admin/users",
      icon: Users,
      description: "Manage system users",
    },
    {
      name: "Queue Dashboard",
      href: "/admin/queues",
      icon: Activity,
      description: "Monitor Jobs",
    },
    {
      name: "Queue Analytics",
      href: "/admin/analytics",
      icon: BarChart3,
      description: "Queue insights",
      badge: "New",
    },
    {
      name: "Job Scheduler",
      href: "/admin/scheduler",
      icon: Clock,
      description: "Schedule jobs",
      badge: "New",
    },
    {
      name: "Activity Logs",
      href: "/admin/activity",
      icon: FileText,
      description: "View system activity",
    },
    {
      name: "System Settings",
      href: "/admin/settings",
      icon: Database,
      description: "Configure system",
      adminOnly: true,
    },
  ];

  const settingsNavigation = [
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
      description: "App preferences",
    },
  ];

  const isActiveLink = (href: string) => {
    return (
      location.pathname === href || location.pathname.startsWith(href + "/")
    );
  };

  const { navigate } = useNavigation();

  const NavSection = ({
    title,
    items,
    showForRole,
  }: {
    title: string;
    items: typeof navigation;
    showForRole?: (role: string) => boolean;
  }) => {
    if (showForRole && user && !showForRole(user.role)) {
      return null;
    }

    const filteredItems = items.filter((item) => {
      if (item.adminOnly && user && !isSuperAdmin(user.role)) {
        return false;
      }
      return true;
    });

    if (filteredItems.length === 0) {
      return null;
    }

    return (
      <div className="mb-6">
        {!isCollapsed && (
          <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {title}
          </h3>
        )}
        <nav className="space-y-1">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const active = isActiveLink(item.href);

            if (isCollapsed) {
              return (
                <TooltipProvider key={item.name}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => navigate(item.href)}
                        className={cn(
                          "group flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 mx-auto mb-2",
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted",
                          isPending && "opacity-50",
                        )}
                        disabled={isPending}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p className="font-medium">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                      {item.badge && (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            return (
              <button
                key={item.name}
                onClick={() => navigate(item.href)}
                className={cn(
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 w-full text-left",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  isPending && "opacity-50",
                )}
                disabled={isPending}
              >
                <Icon
                  className={cn(
                    "mr-3 h-4 w-4 flex-shrink-0 transition-colors",
                    active
                      ? "text-primary-foreground"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="truncate">{item.name}</span>
                    {item.badge && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                  <p
                    className={cn(
                      "text-xs truncate mt-0.5",
                      active
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground/80",
                    )}
                  >
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "fixed top-14 left-0 h-[calc(100vh-3.5rem)] bg-sidebar border-r border-sidebar-border overflow-y-auto z-40 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-64",
      )}
    >
      {/* Toggle Button - Responsive positioning */}
      <div
        className={cn(
          "absolute top-2 z-10 transition-all duration-300",
          isCollapsed ? "left-1/2 transform -translate-x-1/2" : "right-2",
        )}
      >
        <Button
          onClick={toggleSidebar}
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 rounded-lg hover:bg-sidebar-accent transition-all duration-200"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className={cn("p-4 pt-12", isCollapsed && "px-2")}>
        {/* Main Navigation */}
        <NavSection title="Main" items={navigation} />

        {/* Admin Navigation */}
        {user && isAdmin(user.role) && (
          <NavSection
            title="Administration"
            items={adminNavigation}
            showForRole={(role) => isAdmin(role)}
          />
        )}

        {/* Settings Navigation */}
        <NavSection title="Preferences" items={settingsNavigation} />
      </div>
    </aside>
  );
}
