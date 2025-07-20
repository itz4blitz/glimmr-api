export interface UserProfile {
  bio?: string
  avatarUrl?: string
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

export interface UserPreferences {
  notificationEmail?: boolean
  notificationPush?: boolean
  notificationSms?: boolean
  themePreference?: 'light' | 'dark' | 'system'
  languagePreference?: string
  timezonePreference?: string
  dateFormat?: string
  timeFormat?: '12h' | '24h'
  privacySettings?: any
  dashboardLayout?: any
}

export interface User {
  id: string
  email: string
  role: UserRole
  firstName?: string
  lastName?: string
  tenantId?: string
  createdAt: string
  updatedAt: string
  isActive: boolean
  emailVerified?: boolean
  emailVerifiedAt?: string
  lastLoginAt?: string
  apiKey?: string
  profile?: UserProfile
  preferences?: UserPreferences
}

export const UserRole = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
} as const

export type UserRole = typeof UserRole[keyof typeof UserRole]

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
}

export interface AuthResponse {
  access_token: string
  refresh_token?: string
  user: User
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RefreshTokenRequest {
  refresh_token: string
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  password: string
  confirmPassword: string
}
