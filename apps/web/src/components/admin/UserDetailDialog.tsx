import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/user-avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  User,
  Settings,
  Activity,
  Files,
  Shield,
  CheckCircle,
  XCircle,
  Mail,
  MailCheck,
  RotateCcw,
  Trash2,
  UserX,
  UserCheck
} from 'lucide-react'
import { UserProfileForm } from './forms/UserProfileForm'
import { UserPreferencesForm } from './forms/UserPreferencesForm'
import { UserActivityLog } from './UserActivityLog'
import { UserFileManager } from './UserFileManager'
import { useUserManagementStore } from '@/stores/userManagement'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import type { UserRole } from '@/types/auth'

interface UserDetailDialogProps {
  userId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UserDetailDialog({ userId, open, onOpenChange }: UserDetailDialogProps) {
  const [activeTab, setActiveTab] = useState('profile')
  
  const {
    selectedUser,
    loading,
    error,
    loadUserById,
    loadUserActivity,
    loadUserFiles,
    activateUser,
    deactivateUser,
    deleteUser,
    sendPasswordReset,
    resendEmailVerification
  } = useUserManagementStore()

  // Load user data when dialog opens
  useEffect(() => {
    if (open && userId) {
      loadUserById(userId)
    }
  }, [open, userId, loadUserById])

  // Load activity and files after user is loaded
  useEffect(() => {
    if (selectedUser?.id) {
      loadUserActivity(selectedUser.id)
      loadUserFiles(selectedUser.id)
    }
  }, [selectedUser?.id, loadUserActivity, loadUserFiles])

  // Reset tab when dialog closes
  useEffect(() => {
    if (!open) {
      setActiveTab('profile')
    }
  }, [open])

  const handleClose = () => {
    onOpenChange(false)
  }

  const handleActivateUser = async () => {
    if (!selectedUser) return
    
    try {
      await activateUser(selectedUser.id)
      toast.success('User activated successfully')
    } catch (error) {
      toast.error('Failed to activate user')
    }
  }

  const handleDeactivateUser = async () => {
    if (!selectedUser) return
    
    try {
      await deactivateUser(selectedUser.id)
      toast.success('User deactivated successfully')
    } catch (error) {
      toast.error('Failed to deactivate user')
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return
    
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedUser.email}? This action cannot be undone.`
    )
    
    if (confirmed) {
      try {
        await deleteUser(selectedUser.id)
        toast.success('User deleted successfully')
        handleClose()
      } catch (error) {
        toast.error('Failed to delete user')
      }
    }
  }

  const handleSendPasswordReset = async () => {
    if (!selectedUser) return
    
    try {
      await sendPasswordReset(selectedUser.id)
      toast.success('Password reset email sent')
    } catch (error) {
      toast.error('Failed to send password reset')
    }
  }

  const handleResendEmailVerification = async () => {
    if (!selectedUser) return
    
    try {
      await resendEmailVerification(selectedUser.id)
      toast.success('Verification email sent')
    } catch (error) {
      toast.error('Failed to send verification email')
    }
  }



  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'default'
      case 'super_admin':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[90vw] w-[90vw] h-[95vh] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            {loading.userDetail ? (
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ) : selectedUser ? (
              <>
                <UserAvatar
                  src={selectedUser.profile?.avatarUrl}
                  alt={selectedUser.email}
                  email={selectedUser.email}
                  firstName={selectedUser.firstName}
                  lastName={selectedUser.lastName}
                  size="md"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span>
                      {selectedUser.firstName && selectedUser.lastName 
                        ? `${selectedUser.firstName} ${selectedUser.lastName}`
                        : selectedUser.email
                      }
                    </span>
                    <Badge variant={getRoleBadgeVariant(selectedUser.role || 'user')}>
                      <Shield className="h-3 w-3 mr-1" />
                      {selectedUser.role?.replace('_', ' ').toUpperCase() || 'USER'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{selectedUser.email}</span>
                    {selectedUser.isActive ? (
                      <Badge variant="default" className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        <XCircle className="h-3 w-3 mr-1" />
                        Inactive
                      </Badge>
                    )}
                    {selectedUser.emailVerified ? (
                      <Badge variant="outline" className="text-xs">
                        <MailCheck className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-orange-600">
                        <Mail className="h-3 w-3 mr-1" />
                        Unverified
                      </Badge>
                    )}
                  </div>
                </div>
              </>
            ) : (
              'User Details'
            )}
          </DialogTitle>
          
          {selectedUser && (
            <DialogDescription asChild>
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Created {selectedUser.createdAt && !isNaN(new Date(selectedUser.createdAt).getTime())
                    ? formatDistanceToNow(new Date(selectedUser.createdAt), { addSuffix: true })
                    : 'Unknown'
                  }
                  {selectedUser.lastLoginAt && !isNaN(new Date(selectedUser.lastLoginAt).getTime()) && (
                    <> • Last login {formatDistanceToNow(new Date(selectedUser.lastLoginAt), { addSuffix: true })}</>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!selectedUser.emailVerified && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResendEmailVerification}
                      className="text-xs"
                    >
                      <Mail className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">Resend Verification</span>
                      <span className="sm:hidden">Verify</span>
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSendPasswordReset}
                    className="text-xs"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Reset Password</span>
                    <span className="sm:hidden">Reset</span>
                  </Button>

                  {selectedUser.isActive ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeactivateUser}
                      className="text-xs"
                    >
                      <UserX className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">Deactivate</span>
                      <span className="sm:hidden">Disable</span>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleActivateUser}
                      className="text-xs"
                    >
                      <UserCheck className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">Activate</span>
                      <span className="sm:hidden">Enable</span>
                    </Button>
                  )}

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteUser}
                    className="text-xs"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </DialogDescription>
          )}
        </DialogHeader>

        {error.userDetail && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{error.userDetail}</p>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {loading.userDetail ? (
            <div className="space-y-4 p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : selectedUser ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col overflow-hidden">
              <TabsList className="tabs-list-enhanced grid w-full grid-cols-4 h-auto p-1.5 flex-shrink-0">
                <TabsTrigger value="profile" className="tabs-trigger-enhanced flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-3 px-3">
                  <User className="h-4 w-4" />
                  <span className="text-xs sm:text-sm font-medium">Profile</span>
                </TabsTrigger>
                <TabsTrigger value="preferences" className="tabs-trigger-enhanced flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-3 px-3">
                  <Settings className="h-4 w-4" />
                  <span className="text-xs sm:text-sm font-medium">Settings</span>
                </TabsTrigger>
                <TabsTrigger value="activity" className="tabs-trigger-enhanced flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-3 px-3">
                  <Activity className="h-4 w-4" />
                  <span className="text-xs sm:text-sm font-medium">Activity</span>
                </TabsTrigger>
                <TabsTrigger value="files" className="tabs-trigger-enhanced flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-3 px-3">
                  <Files className="h-4 w-4" />
                  <span className="text-xs sm:text-sm font-medium">Files</span>
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-hidden">
                <TabsContent value="profile" className="mt-0 h-full overflow-auto">
                  <div className="p-3 sm:p-4 pb-8 space-y-4 sm:space-y-6">
                    <UserProfileForm
                      user={selectedUser}
                      onSave={() => {
                        // Reload user data after save
                        loadUserById(selectedUser.id)
                      }}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="preferences" className="mt-0 h-full overflow-auto">
                  <div className="p-3 sm:p-4 pb-8 space-y-4 sm:space-y-6">
                    <UserPreferencesForm
                      user={selectedUser}
                      onSave={() => {
                        // Reload user data after save
                        loadUserById(selectedUser.id)
                      }}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="mt-0 h-full overflow-auto">
                  <div className="p-3 sm:p-4 pb-8 space-y-4 sm:space-y-6">
                    {loading.userDetail ? (
                      <div className="text-center py-8">
                        <Skeleton className="h-8 w-64 mx-auto mb-4" />
                        <Skeleton className="h-4 w-48 mx-auto" />
                      </div>
                    ) : selectedUser ? (
                      <UserActivityLog userId={selectedUser.id} />
                    ) : null}
                  </div>
                </TabsContent>

                <TabsContent value="files" className="mt-0 h-full overflow-auto">
                  <div className="p-3 sm:p-4 pb-8 space-y-4 sm:space-y-6">
                    {loading.userDetail ? (
                      <div className="text-center py-8">
                        <Skeleton className="h-8 w-64 mx-auto mb-4" />
                        <Skeleton className="h-4 w-48 mx-auto" />
                      </div>
                    ) : selectedUser ? (
                      <UserFileManager userId={selectedUser.id} />
                    ) : null}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
