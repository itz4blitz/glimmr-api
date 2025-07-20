import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Home,
  User,
  Settings,
  Shield,
  BarChart3,
  Users,
  Database,
  FileText,
  Activity,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useSidebarStore } from '@/stores/sidebar'
import { isAdmin, isSuperAdmin } from '@/lib/permissions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function Sidebar() {
  const { user } = useAuthStore()
  const { isCollapsed, toggleSidebar } = useSidebarStore()
  const location = useLocation()

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: Home,
      description: 'Overview and quick actions'
    },
    {
      name: 'Profile',
      href: '/profile',
      icon: User,
      description: 'Manage your account'
    },
    {
      name: 'Analytics',
      href: '/analytics',
      icon: BarChart3,
      description: 'View reports and insights',
      badge: 'New'
    },
    {
      name: 'Documents',
      href: '/documents',
      icon: FileText,
      description: 'Manage your files'
    },
  ]

  const adminNavigation = [
    {
      name: 'User Management',
      href: '/admin/users',
      icon: Users,
      description: 'Manage system users'
    },
    {
      name: 'Queue Dashboard',
      href: '/admin/queues',
      icon: Activity,
      description: 'Monitor BullMQ queues'
    },
    {
      name: 'System Settings',
      href: '/admin/settings',
      icon: Database,
      description: 'Configure system',
      adminOnly: true
    },
  ]

  const settingsNavigation = [
    {
      name: 'Settings',
      href: '/settings',
      icon: Settings,
      description: 'App preferences'
    },
  ]

  const isActiveLink = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/')
  }

  const NavSection = ({ 
    title, 
    items, 
    showForRole 
  }: { 
    title: string
    items: typeof navigation
    showForRole?: (role: string) => boolean
  }) => {
    if (showForRole && user && !showForRole(user.role)) {
      return null
    }

    const filteredItems = items.filter(item => {
      if (item.adminOnly && user && !isSuperAdmin(user.role)) {
        return false
      }
      return true
    })

    if (filteredItems.length === 0) {
      return null
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
            const Icon = item.icon
            const active = isActiveLink(item.href)

            if (isCollapsed) {
              return (
                <TooltipProvider key={item.name}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        to={item.href}
                        className={cn(
                          'group flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 mx-auto mb-2',
                          active
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p className="font-medium">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      )}
                      {item.badge && (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            }

            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <Icon className={cn(
                  'mr-3 h-4 w-4 flex-shrink-0 transition-colors',
                  active ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="truncate">{item.name}</span>
                    {item.badge && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                  <p className={cn(
                    'text-xs truncate mt-0.5',
                    active ? 'text-primary-foreground/80' : 'text-muted-foreground/80'
                  )}>
                    {item.description}
                  </p>
                </div>
              </Link>
            )
          })}
        </nav>
      </div>
    )
  }

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{
        x: 0,
        opacity: 1,
        width: isCollapsed ? '4rem' : '16rem'
      }}
      transition={{ duration: 0.3 }}
      className={cn(
        "fixed top-14 left-0 h-[calc(100vh-3.5rem)] bg-sidebar border-r border-sidebar-border overflow-y-auto z-40",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Toggle Button - Top right with proper spacing */}
      <div className="absolute top-2 right-2 z-10">
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

        {/* User Info Card */}
        {user && !isCollapsed && (
          <div className="mt-6 p-3 bg-sidebar-accent rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-sidebar-primary rounded-full flex items-center justify-center">
                <span className="text-sidebar-primary-foreground font-medium text-sm">
                  {user.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-accent-foreground truncate">
                  {user.email}
                </p>
                <p className="text-xs text-sidebar-accent-foreground/70 truncate">
                  {user.role.replace('_', ' ').toLowerCase()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Collapsed User Avatar */}
        {user && isCollapsed && (
          <div className="mt-6 flex justify-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-8 h-8 bg-sidebar-primary rounded-full flex items-center justify-center">
                    <span className="text-sidebar-primary-foreground font-medium text-sm">
                      {user.email?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="font-medium">{user.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.role.replace('_', ' ').toLowerCase()}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
    </motion.aside>
  )
}
