import type { User, UserRole, UserPreferences as AuthUserPreferences } from './auth'

// API Request/Response Types
export interface UserListParams {
  page?: number
  limit?: number
  sortBy?: UserSortField
  sortOrder?: 'asc' | 'desc'
  search?: string
  role?: string
  isActive?: boolean
  emailVerified?: boolean
  createdAfter?: string
  createdBefore?: string
  lastLoginAfter?: string
  lastLoginBefore?: string
}

export type UserSortField = 'email' | 'firstName' | 'lastName' | 'createdAt' | 'lastLoginAt'

export interface UserListItem {
  id: string
  email: string
  firstName?: string
  lastName?: string
  role: UserRole
  isActive: boolean
  emailVerified: boolean
  lastLoginAt?: string
  createdAt: string
  profile?: {
    avatarUrl?: string
    company?: string
    jobTitle?: string
  }
  activityCount?: number
}

export interface UserListResponse {
  users: UserListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface UserProfile {
  id: string
  userId: string
  bio?: string
  avatarUrl?: string
  phoneNumber?: string
  timezone: string
  languagePreference: string
  dateOfBirth?: string
  company?: string
  jobTitle?: string
  city?: string
  country?: string
  website?: string
  linkedinUrl?: string
  twitterUrl?: string
  githubUrl?: string
  createdAt: string
  updatedAt: string
}

export interface UserPreferences {
  id: string
  userId: string
  notificationEmail: boolean
  notificationPush: boolean
  notificationSms: boolean
  themePreference: string
  languagePreference: string
  timezonePreference: string
  dateFormat?: string
  timeFormat?: string
  privacySettings?: Record<string, any>
  dashboardLayout?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface UserActivityLog {
  id: string
  userId: string
  action: string
  resourceType: string
  resourceId?: string
  metadata?: Record<string, any>
  timestamp: string
  ipAddress?: string
  userAgent?: string
}

export interface UserFile {
  id: string
  userId: string
  originalName: string
  fileName: string
  mimeType: string
  fileSize: number
  fileType: 'avatar' | 'document'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface UserWithProfile extends User {
  profile?: UserProfile
  preferences?: AuthUserPreferences
  lastActivity?: UserActivityLog
  fileCount?: number
}

export interface UserStats {
  totalUsers: number
  activeUsers: number
  inactiveUsers: number
  verifiedUsers: number
  unverifiedUsers: number
  adminUsers: number
  regularUsers: number
  newUsersThisMonth: number
  newUsersThisWeek: number
}

// Update DTOs
export interface UpdateUserDto {
  firstName?: string
  lastName?: string
  email?: string
  isActive?: boolean
  emailVerified?: boolean
}

export interface UpdateUserRoleDto {
  role: UserRole
}

export interface ProfileUpdateData {
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

export interface PreferencesUpdateData {
  notificationEmail?: boolean
  notificationPush?: boolean
  notificationSms?: boolean
  themePreference?: string
  languagePreference?: string
  timezonePreference?: string
  dateFormat?: string
  timeFormat?: string
  privacySettings?: Record<string, any>
  dashboardLayout?: Record<string, any>
}

// Bulk Operations
export interface BulkUserActionDto {
  userIds: string[]
  action: 'activate' | 'deactivate' | 'delete'
  role?: UserRole
}

export interface BulkActionResult {
  successful: string[]
  failed: Array<{ userId: string; error: string }>
  total: number
}

// Pagination and Filtering
export interface PaginationParams {
  page?: number
  limit?: number
}

export interface ActivityLogResponse {
  activities: UserActivityLog[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// Advanced Filters
export interface AdvancedFilters {
  roles: UserRole[]
  statuses: ('active' | 'inactive')[]
  emailVerified: boolean | null
  dateRange: {
    field: 'createdAt' | 'lastLoginAt'
    start: Date | null
    end: Date | null
  }
  hasActivity: boolean | null
  hasFiles: boolean | null
}

export interface UserFilters {
  search: string
  role: string
  status: string
  emailVerified: string
  dateRange: string
  advanced?: AdvancedFilters
}

// Export/Import
export interface ExportOptions {
  format: 'csv' | 'excel' | 'json'
  fields: string[]
  filters?: UserFilters
}

export interface ImportResult {
  successful: number
  failed: number
  errors: Array<{ row: number; error: string }>
  total: number
}

// UI State
export interface PaginationState {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface LoadingState {
  users: boolean
  userDetail: boolean
  stats: boolean
  bulkAction: boolean
  export: boolean
  import: boolean
}

export interface ErrorState {
  users: string | null
  userDetail: string | null
  stats: string | null
  bulkAction: string | null
  export: string | null
  import: string | null
}
