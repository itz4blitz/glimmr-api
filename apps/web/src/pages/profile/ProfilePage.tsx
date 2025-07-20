import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'
import { UnsavedChangesProvider, useUnsavedChangesContext } from '@/contexts/UnsavedChangesContext'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/user-avatar'
import {
  User,
  Settings,
  Shield,
  Activity,
  Camera,
  Mail,
  Calendar,
  MapPin,
  Building,
  Briefcase,
  Globe,
  Github,
  Linkedin,
  Twitter
} from 'lucide-react'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { SecuritySettings } from '@/components/profile/SecuritySettings'
import { PreferencesSettings } from '@/components/profile/PreferencesSettings'
import { ActivityHistory } from '@/components/profile/ActivityHistory'
import { AvatarUpload } from '@/components/profile/AvatarUpload'

function ProfilePageContent() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('profile')
  const { checkUnsavedChanges, hasUnsavedChanges } = useUnsavedChangesContext()

  // Protect against browser navigation
  const { blocker } = useUnsavedChanges({
    hasUnsavedChanges,
    message: 'You have unsaved changes in your profile. Are you sure you want to leave?'
  })

  // Handle React Router navigation blocking
  useEffect(() => {
    if (blocker.state === 'blocked') {
      checkUnsavedChanges(() => {
        blocker.proceed()
      })
    }
  }, [blocker.state, checkUnsavedChanges, blocker])

  const handleTabChange = (newTab: string) => {
    if (newTab !== activeTab) {
      checkUnsavedChanges(() => {
        setActiveTab(newTab)
      })
    }
  }

  if (!user) {
    return null
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Profile Header */}
        <div className="mb-6 sm:mb-8">
          <Card>
            <CardContent className="p-4 sm:pt-6">
              {/* Mobile Layout */}
              <div className="flex flex-col items-center gap-4 md:hidden">
                {/* Avatar Section */}
                <div className="relative flex-shrink-0">
                  <UserAvatar
                    src={user.profile?.avatarUrl}
                    alt={user.email}
                    email={user.email}
                    firstName={user.firstName}
                    lastName={user.lastName}
                    size="lg"
                    className="h-20 w-20"
                  />
                  <AvatarUpload>
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full p-0"
                    >
                      <Camera className="h-3 w-3" />
                    </Button>
                  </AvatarUpload>
                </div>

                {/* User Info */}
                <div className="text-center space-y-3 w-full">
                  <div className="space-y-2">
                    <h1 className="text-xl font-bold break-words">
                      {user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user.email
                      }
                    </h1>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                      {user.role}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-xs text-muted-foreground">
                    {/* Only show email if it's different from the name */}
                    {user.firstName && user.lastName && (
                      <div className="flex items-center justify-center gap-1">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="break-all">{user.email}</span>
                      </div>
                    )}
                    {user.profile?.company && (
                      <div className="flex items-center justify-center gap-1">
                        <Building className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{user.profile.company}</span>
                      </div>
                    )}
                    {user.profile?.jobTitle && (
                      <div className="flex items-center justify-center gap-1">
                        <Briefcase className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{user.profile.jobTitle}</span>
                      </div>
                    )}
                    {user.profile?.city && user.profile?.country && (
                      <div className="flex items-center justify-center gap-1">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{user.profile.city}, {user.profile.country}</span>
                      </div>
                    )}
                  </div>

                  {user.profile?.bio && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {user.profile.bio}
                    </p>
                  )}

                  {/* Social Links */}
                  <div className="flex items-center justify-center gap-1 pt-2">
                    {user.profile?.website && (
                      <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                        <a href={user.profile.website} target="_blank" rel="noopener noreferrer">
                          <Globe className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                    {user.profile?.githubUrl && (
                      <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                        <a href={user.profile.githubUrl} target="_blank" rel="noopener noreferrer">
                          <Github className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                    {user.profile?.linkedinUrl && (
                      <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                        <a href={user.profile.linkedinUrl} target="_blank" rel="noopener noreferrer">
                          <Linkedin className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                    {user.profile?.twitterUrl && (
                      <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                        <a href={user.profile.twitterUrl} target="_blank" rel="noopener noreferrer">
                          <Twitter className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                  </div>

                  {/* No edit button needed - forms are always editable */}
                </div>
              </div>

              {/* Desktop/Tablet Layout */}
              <div className="hidden md:flex items-start gap-6">
                {/* Avatar Section */}
                <div className="relative flex-shrink-0">
                  <UserAvatar
                    src={user.profile?.avatarUrl}
                    alt={user.email}
                    email={user.email}
                    firstName={user.firstName}
                    lastName={user.lastName}
                    size="xl"
                    className="h-24 w-24 lg:h-32 lg:w-32"
                  />
                  <AvatarUpload>
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  </AvatarUpload>
                  {/* Online Status Indicator */}
                  <div className="absolute top-0 right-0 h-4 w-4 bg-green-500 border-2 border-background rounded-full"></div>
                </div>

                {/* Main User Info */}
                <div className="flex-1 space-y-4 min-w-0">
                  {/* Header Row */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl lg:text-3xl font-bold break-words">
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.email
                        }
                      </h1>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="text-sm">
                        {user.role}
                      </Badge>
                      {user.emailVerified && (
                        <Badge variant="outline" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      {/* Only show email if it's different from the name */}
                      {user.firstName && user.lastName && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-4 w-4 flex-shrink-0" />
                          <span className="break-all">{user.email}</span>
                        </div>
                      )}
                      {user.profile?.company && (
                        <div className="flex items-center gap-1">
                          <Building className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{user.profile.company}</span>
                        </div>
                      )}
                      {user.profile?.jobTitle && (
                        <div className="flex items-center gap-1">
                          <Briefcase className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{user.profile.jobTitle}</span>
                        </div>
                      )}
                      {user.profile?.city && user.profile?.country && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{user.profile.city}, {user.profile.country}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span>Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bio Section */}
                  {user.profile?.bio && (
                    <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
                      {user.profile.bio}
                    </p>
                  )}

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-t border-b">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-foreground">
                        {new Date().getFullYear() - new Date(user.createdAt).getFullYear() || '< 1'}
                      </div>
                      <div className="text-xs text-muted-foreground">Years Active</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-foreground">
                        {user.lastLoginAt ? 'Recently' : 'Never'}
                      </div>
                      <div className="text-xs text-muted-foreground">Last Login</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-600">
                        Active
                      </div>
                      <div className="text-xs text-muted-foreground">Status</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-foreground">
                        {user.role === 'admin' ? 'Admin' : 'User'}
                      </div>
                      <div className="text-xs text-muted-foreground">Access Level</div>
                    </div>
                  </div>

                  {/* Social Links */}
                  <div className="flex items-center gap-2">
                    {user.profile?.website && (
                      <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                        <a href={user.profile.website} target="_blank" rel="noopener noreferrer">
                          <Globe className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {user.profile?.githubUrl && (
                      <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                        <a href={user.profile.githubUrl} target="_blank" rel="noopener noreferrer">
                          <Github className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {user.profile?.linkedinUrl && (
                      <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                        <a href={user.profile.linkedinUrl} target="_blank" rel="noopener noreferrer">
                          <Linkedin className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {user.profile?.twitterUrl && (
                      <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                        <a href={user.profile.twitterUrl} target="_blank" rel="noopener noreferrer">
                          <Twitter className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>

                  {/* Social Links */}
                  <div className="flex items-center gap-1 pt-2">
                    {user.profile?.website && (
                      <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                        <a href={user.profile.website} target="_blank" rel="noopener noreferrer">
                          <Globe className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {user.profile?.githubUrl && (
                      <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                        <a href={user.profile.githubUrl} target="_blank" rel="noopener noreferrer">
                          <Github className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {user.profile?.linkedinUrl && (
                      <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                        <a href={user.profile.linkedinUrl} target="_blank" rel="noopener noreferrer">
                          <Linkedin className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {user.profile?.twitterUrl && (
                      <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                        <a href={user.profile.twitterUrl} target="_blank" rel="noopener noreferrer">
                          <Twitter className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>

                {/* No edit button needed - forms are always editable */}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6 sm:space-y-8">
          <TabsList className="tabs-list-enhanced grid w-full grid-cols-4 h-auto p-1.5">
            <TabsTrigger value="profile" className="tabs-trigger-enhanced flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-3 px-3">
              <User className="h-4 w-4" />
              <span className="text-xs sm:text-sm font-medium">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="tabs-trigger-enhanced flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-3 px-3">
              <Shield className="h-4 w-4" />
              <span className="text-xs sm:text-sm font-medium">Security</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="tabs-trigger-enhanced flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-3 px-3">
              <Settings className="h-4 w-4" />
              <span className="text-xs sm:text-sm font-medium">Settings</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="tabs-trigger-enhanced flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-3 px-3">
              <Activity className="h-4 w-4" />
              <span className="text-xs sm:text-sm font-medium">Activity</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
                <CardTitle className="text-lg sm:text-xl">Personal Information</CardTitle>
                <CardDescription className="text-sm">
                  Update your personal details and profile information.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                <ProfileForm />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
                <CardTitle className="text-lg sm:text-xl">Security Settings</CardTitle>
                <CardDescription className="text-sm">
                  Manage your password, two-factor authentication, and security preferences.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                <SecuritySettings />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
                <CardTitle className="text-lg sm:text-xl">Preferences</CardTitle>
                <CardDescription className="text-sm">
                  Customize your application settings and preferences.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                <PreferencesSettings />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
                <CardTitle className="text-lg sm:text-xl">Activity History</CardTitle>
                <CardDescription className="text-sm">
                  View your recent account activity and login history.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                <ActivityHistory />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}

export function ProfilePage() {
  return (
    <UnsavedChangesProvider>
      <ProfilePageContent />
    </UnsavedChangesProvider>
  )
}
