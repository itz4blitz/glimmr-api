
import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserAvatar } from '@/components/ui/user-avatar'
import { Separator } from '@/components/ui/separator'
import {
  User,
  Mail,
  Shield,
  Key,
  CheckCircle,
  XCircle,
  Clock,
  Save,
  X
} from 'lucide-react'
import { useFormState } from '@/hooks/useFormState'
import { useUserManagementStore } from '@/stores/userManagement'
import type { UserWithProfile, UpdateUserDto, ProfileUpdateData } from '@/types/userManagement'
import type { UserRole } from '@/types/auth'
import { formatDistanceToNow } from 'date-fns'

interface UserProfileFormProps {
  user: UserWithProfile
  onSave?: () => void
  onCancel?: () => void
  isLoading?: boolean
}

interface FormData extends UpdateUserDto {
  // Profile fields
  bio?: string
  phoneNumber?: string
  timezone?: string
  languagePreference?: string
  dateOfBirth?: string
  company?: string
  jobTitle?: string
  city?: string
  country?: string
  website?: string
  linkedinUrl?: string
  twitterUrl?: string
  githubUrl?: string
}

const timezones = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney'
]



export function UserProfileForm({ user, onSave, onCancel }: UserProfileFormProps) {
  const { updateUser, updateUserProfile, updateUserRole } = useUserManagementStore()

  // Prepare initial form data - memoize to prevent infinite loops
  const initialData: FormData = useMemo(() => ({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    email: user.email || '',
    isActive: user.isActive ?? true,
    emailVerified: user.emailVerified ?? false,
    bio: user.profile?.bio || '',
    phoneNumber: user.profile?.phoneNumber || '',
    timezone: user.profile?.timezone || 'UTC',
    languagePreference: user.profile?.languagePreference || 'en',
    dateOfBirth: user.profile?.dateOfBirth || '',
    company: user.profile?.company || '',
    jobTitle: user.profile?.jobTitle || '',
    city: user.profile?.city || '',
    country: user.profile?.country || '',
    website: user.profile?.website || '',
    linkedinUrl: user.profile?.linkedinUrl || '',
    twitterUrl: user.profile?.twitterUrl || '',
    githubUrl: user.profile?.githubUrl || ''
  }), [user])

  const {
    formData,
    isSubmitting,
    setFieldValue,
    getFieldError,
    canSave,
    save,
    cancel
  } = useFormState({
    initialData,
    onSave: async (data) => {
      // Split data into user and profile updates
      const userUpdate: UpdateUserDto = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        isActive: data.isActive,
        emailVerified: data.emailVerified
      }

      const profileUpdate: ProfileUpdateData = {
        bio: data.bio,
        phoneNumber: data.phoneNumber,
        timezone: data.timezone,
        languagePreference: data.languagePreference,
        dateOfBirth: data.dateOfBirth,
        company: data.company,
        jobTitle: data.jobTitle,
        city: data.city,
        country: data.country,
        website: data.website,
        linkedinUrl: data.linkedinUrl,
        twitterUrl: data.twitterUrl,
        githubUrl: data.githubUrl
      }

      // Update user basic info
      await updateUser(user.id, userUpdate)
      
      // Update profile if there are profile changes
      const hasProfileChanges = Object.values(profileUpdate).some(value => value !== undefined && value !== '')
      if (hasProfileChanges) {
        await updateUserProfile(user.id, profileUpdate)
      }

      onSave?.()
    },
    onCancel: () => {
      onCancel?.()
    }
  })

  const handleRoleChange = async (newRole: UserRole) => {
    try {
      await updateUserRole(user.id, newRole)
    } catch (error) {
      console.error('Failed to update role:', error)
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <UserAvatar
            src={user.profile?.avatarUrl}
            alt={user.email}
            email={user.email}
            firstName={user.firstName}
            lastName={user.lastName}
            size="lg"
          />
          <div>
            <h2 className="text-2xl font-bold">
              {user.firstName && user.lastName 
                ? `${user.firstName} ${user.lastName}`
                : user.email
              }
            </h2>
            <p className="text-muted-foreground">{user.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={getRoleBadgeVariant(user.role || 'user')}>
                <Shield className="h-3 w-3 mr-1" />
                {user.role?.replace('_', ' ').toUpperCase() || 'USER'}
              </Badge>
              {user.isActive ? (
                <Badge variant="default">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="h-3 w-3 mr-1" />
                  Inactive
                </Badge>
              )}
              {user.emailVerified ? (
                <Badge variant="outline">
                  <Mail className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="text-orange-600">
                  <Mail className="h-3 w-3 mr-1" />
                  Unverified
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={cancel}
            disabled={isSubmitting}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={!canSave || isSubmitting}
            className="min-w-[100px]"
          >
            {isSubmitting ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Basic Information
          </CardTitle>
          <CardDescription>
            Update the user's basic account information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName || ''}
                onChange={(e) => setFieldValue('firstName', e.target.value)}
              />
              {getFieldError('firstName') && (
                <p className="text-sm text-destructive">{getFieldError('firstName')}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName || ''}
                onChange={(e) => setFieldValue('lastName', e.target.value)}
              />
              {getFieldError('lastName') && (
                <p className="text-sm text-destructive">{getFieldError('lastName')}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFieldValue('email', e.target.value)}
            />
            {getFieldError('email') && (
              <p className="text-sm text-destructive">{getFieldError('email')}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={user.role || 'user'}
                onValueChange={(value) => handleRoleChange(value as UserRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => setFieldValue('timezone', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Account Status</Label>
              <p className="text-sm text-muted-foreground">
                Enable or disable this user account
              </p>
            </div>
            <Switch
              checked={formData.isActive}
              onCheckedChange={(checked) => setFieldValue('isActive', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Verified</Label>
              <p className="text-sm text-muted-foreground">
                Mark email as verified or unverified
              </p>
            </div>
            <Switch
              checked={formData.emailVerified}
              onCheckedChange={(checked) => setFieldValue('emailVerified', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Additional profile details and contact information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={formData.bio || ''}
              onChange={(e) => setFieldValue('bio', e.target.value)}
              placeholder="Tell us about yourself..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={formData.phoneNumber || ''}
                onChange={(e) => setFieldValue('phoneNumber', e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth || ''}
                onChange={(e) => setFieldValue('dateOfBirth', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={formData.company || ''}
                onChange={(e) => setFieldValue('company', e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input
                id="jobTitle"
                value={formData.jobTitle || ''}
                onChange={(e) => setFieldValue('jobTitle', e.target.value)}
                placeholder="Software Engineer"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city || ''}
                onChange={(e) => setFieldValue('city', e.target.value)}
                placeholder="San Francisco"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={formData.country || ''}
                onChange={(e) => setFieldValue('country', e.target.value)}
                placeholder="United States"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="text-sm font-medium">Social Links</h4>
            
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website || ''}
                onChange={(e) => setFieldValue('website', e.target.value)}
                placeholder="https://example.com"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="linkedinUrl">LinkedIn</Label>
                <Input
                  id="linkedinUrl"
                  type="url"
                  value={formData.linkedinUrl || ''}
                  onChange={(e) => setFieldValue('linkedinUrl', e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitterUrl">Twitter</Label>
                <Input
                  id="twitterUrl"
                  type="url"
                  value={formData.twitterUrl || ''}
                  onChange={(e) => setFieldValue('twitterUrl', e.target.value)}
                  placeholder="https://twitter.com/username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="githubUrl">GitHub</Label>
              <Input
                id="githubUrl"
                type="url"
                value={formData.githubUrl || ''}
                onChange={(e) => setFieldValue('githubUrl', e.target.value)}
                placeholder="https://github.com/username"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Account Information
          </CardTitle>
          <CardDescription>
            Read-only account details and timestamps
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Created</Label>
              <p className="text-sm text-muted-foreground">
                {user.createdAt && !isNaN(new Date(user.createdAt).getTime())
                  ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })
                  : 'Unknown'
                }
              </p>
            </div>
            <div className="space-y-2">
              <Label>Last Login</Label>
              <p className="text-sm text-muted-foreground">
                {user.lastLoginAt && !isNaN(new Date(user.lastLoginAt).getTime())
                  ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })
                  : 'Never'
                }
              </p>
            </div>
          </div>

          {user.apiKey && (
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={user.apiKey}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="sm">
                  Copy
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
