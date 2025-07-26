import { Link, useLocation } from "react-router-dom";
import { Search, Command, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileNav } from "./MobileNav";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useAuthStore } from "@/stores/auth";

// Breadcrumb helper function
const getBreadcrumbs = (pathname: string) => {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = [{ label: "Dashboard", href: "/dashboard" }];

  if (segments.length === 0 || segments[0] === "dashboard") {
    return breadcrumbs;
  }

  if (segments[0] === "profile") {
    breadcrumbs.push({ label: "Profile", href: "/profile" });
  } else if (segments[0] === "admin") {
    breadcrumbs.push({ label: "Administration", href: "/admin" });
    if (segments[1] === "users") {
      breadcrumbs.push({ label: "User Management", href: "/admin/users" });
    } else if (segments[1] === "queues") {
      breadcrumbs.push({ label: "Queue Dashboard", href: "/admin/queues" });
    } else if (segments[1] === "settings") {
      breadcrumbs.push({ label: "System Settings", href: "/admin/settings" });
    }
  } else if (segments[0] === "settings") {
    breadcrumbs.push({ label: "Settings", href: "/settings" });
  }

  return breadcrumbs;
};

export function Header() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const breadcrumbs = getBreadcrumbs(location.pathname);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        {/* Mobile Navigation */}
        <MobileNav />

        {/* Logo */}
        <div className="flex items-center space-x-2 mr-4">
          <Link to="/dashboard" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">
                G
              </span>
            </div>
            <span className="hidden sm:inline-block font-semibold text-lg">
              Glimmr
            </span>
          </Link>
        </div>

        {/* Breadcrumbs - Hidden on mobile */}
        <div className="hidden lg:flex items-center space-x-1 text-sm text-muted-foreground mx-4">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.href} className="flex items-center">
              {index > 0 && <ChevronRight className="h-3 w-3 mx-1" />}
              <Link
                to={crumb.href}
                className={`hover:text-foreground transition-colors ${
                  index === breadcrumbs.length - 1
                    ? "text-foreground font-medium"
                    : ""
                }`}
              >
                {crumb.label}
              </Link>
            </div>
          ))}
        </div>

        {/* Search Bar with Command Palette */}
        <div className="hidden md:flex flex-1 max-w-sm mx-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search... (⌘K)"
              className="pl-10 pr-16 w-full"
              readOnly
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                <Command className="h-3 w-3" />K
              </kbd>
            </div>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center space-x-3 ml-auto">
          {/* Search button for mobile */}
          <Button variant="ghost" size="icon" className="md:hidden">
            <Search className="h-4 w-4" />
            <span className="sr-only">Search</span>
          </Button>

          {/* Notifications */}
          <NotificationBell />

          {/* Theme Toggle - Hidden on mobile (shown in mobile nav) */}
          <div className="hidden md:block">
            <ThemeToggle />
          </div>

          {/* User Menu */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 px-3 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {user.email?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden xl:block text-left">
                      <p className="text-sm font-medium leading-none">
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.email?.split("@")[0] || "User"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {user.role.replace("_", " ").toLowerCase()}
                      </p>
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.email}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.role}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
