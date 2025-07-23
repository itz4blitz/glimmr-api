export enum ActivityCategory {
  AUTHENTICATION = 'authentication',
  ACCOUNT = 'account',
  DATA = 'data',
  ADMINISTRATIVE = 'administrative',
  SECURITY = 'security',
  SYSTEM = 'system',
}

export enum ActivityImportance {
  HIGH = 'high',      // Security events, admin actions
  MEDIUM = 'medium',  // Data modifications, settings changes
  LOW = 'low',        // Regular usage
  NOISE = 'noise',    // Should not be logged
}

export interface ActivityConfig {
  action: string;
  category: ActivityCategory;
  importance: ActivityImportance;
  description: string;
  shouldLog: boolean;
}

// Configuration for all activities
export const ACTIVITY_CONFIG: Record<string, ActivityConfig> = {
  // Authentication & Security
  'auth_login': {
    action: 'auth_login',
    category: ActivityCategory.AUTHENTICATION,
    importance: ActivityImportance.HIGH,
    description: 'User login',
    shouldLog: true,
  },
  'auth_login_failed': {
    action: 'auth_login_failed',
    category: ActivityCategory.SECURITY,
    importance: ActivityImportance.HIGH,
    description: 'Failed login attempt',
    shouldLog: true,
  },
  'auth_logout': {
    action: 'auth_logout',
    category: ActivityCategory.AUTHENTICATION,
    importance: ActivityImportance.MEDIUM,
    description: 'User logout',
    shouldLog: true,
  },
  'auth_register': {
    action: 'auth_register',
    category: ActivityCategory.AUTHENTICATION,
    importance: ActivityImportance.HIGH,
    description: 'New user registration',
    shouldLog: true,
  },
  'password_reset': {
    action: 'password_reset',
    category: ActivityCategory.SECURITY,
    importance: ActivityImportance.HIGH,
    description: 'Password reset',
    shouldLog: true,
  },
  'password_change': {
    action: 'password_change',
    category: ActivityCategory.SECURITY,
    importance: ActivityImportance.HIGH,
    description: 'Password changed',
    shouldLog: true,
  },
  'email_verify': {
    action: 'email_verify',
    category: ActivityCategory.ACCOUNT,
    importance: ActivityImportance.MEDIUM,
    description: 'Email verified',
    shouldLog: true,
  },
  'two_factor_enable': {
    action: 'two_factor_enable',
    category: ActivityCategory.SECURITY,
    importance: ActivityImportance.HIGH,
    description: '2FA enabled',
    shouldLog: true,
  },
  'two_factor_disable': {
    action: 'two_factor_disable',
    category: ActivityCategory.SECURITY,
    importance: ActivityImportance.HIGH,
    description: '2FA disabled',
    shouldLog: true,
  },
  'api_key_generate': {
    action: 'api_key_generate',
    category: ActivityCategory.SECURITY,
    importance: ActivityImportance.HIGH,
    description: 'API key generated',
    shouldLog: true,
  },
  'api_key_revoke': {
    action: 'api_key_revoke',
    category: ActivityCategory.SECURITY,
    importance: ActivityImportance.HIGH,
    description: 'API key revoked',
    shouldLog: true,
  },

  // Account Management
  'profile_update': {
    action: 'profile_update',
    category: ActivityCategory.ACCOUNT,
    importance: ActivityImportance.MEDIUM,
    description: 'Profile updated',
    shouldLog: true,
  },
  'avatar_upload': {
    action: 'avatar_upload',
    category: ActivityCategory.ACCOUNT,
    importance: ActivityImportance.LOW,
    description: 'Avatar uploaded',
    shouldLog: true,
  },
  'avatar_remove': {
    action: 'avatar_remove',
    category: ActivityCategory.ACCOUNT,
    importance: ActivityImportance.LOW,
    description: 'Avatar removed',
    shouldLog: true,
  },
  'preferences_update': {
    action: 'preferences_update',
    category: ActivityCategory.ACCOUNT,
    importance: ActivityImportance.LOW,
    description: 'Preferences updated',
    shouldLog: true,
  },
  'account_delete': {
    action: 'account_delete',
    category: ActivityCategory.ACCOUNT,
    importance: ActivityImportance.HIGH,
    description: 'Account deleted',
    shouldLog: true,
  },

  // Data Operations
  'file_upload': {
    action: 'file_upload',
    category: ActivityCategory.DATA,
    importance: ActivityImportance.MEDIUM,
    description: 'File uploaded',
    shouldLog: true,
  },
  'file_download': {
    action: 'file_download',
    category: ActivityCategory.DATA,
    importance: ActivityImportance.LOW,
    description: 'File downloaded',
    shouldLog: true,
  },
  'file_delete': {
    action: 'file_delete',
    category: ActivityCategory.DATA,
    importance: ActivityImportance.MEDIUM,
    description: 'File deleted',
    shouldLog: true,
  },
  'data_export': {
    action: 'data_export',
    category: ActivityCategory.DATA,
    importance: ActivityImportance.MEDIUM,
    description: 'Data exported',
    shouldLog: true,
  },
  'bulk_operation': {
    action: 'bulk_operation',
    category: ActivityCategory.DATA,
    importance: ActivityImportance.HIGH,
    description: 'Bulk operation performed',
    shouldLog: true,
  },

  // Administrative Actions
  'user_role_update': {
    action: 'user_role_update',
    category: ActivityCategory.ADMINISTRATIVE,
    importance: ActivityImportance.HIGH,
    description: 'User role changed',
    shouldLog: true,
  },
  'user_activate': {
    action: 'user_activate',
    category: ActivityCategory.ADMINISTRATIVE,
    importance: ActivityImportance.HIGH,
    description: 'User activated',
    shouldLog: true,
  },
  'user_deactivate': {
    action: 'user_deactivate',
    category: ActivityCategory.ADMINISTRATIVE,
    importance: ActivityImportance.HIGH,
    description: 'User deactivated',
    shouldLog: true,
  },
  'permission_grant': {
    action: 'permission_grant',
    category: ActivityCategory.ADMINISTRATIVE,
    importance: ActivityImportance.HIGH,
    description: 'Permission granted',
    shouldLog: true,
  },
  'permission_revoke': {
    action: 'permission_revoke',
    category: ActivityCategory.ADMINISTRATIVE,
    importance: ActivityImportance.HIGH,
    description: 'Permission revoked',
    shouldLog: true,
  },
  'system_settings_change': {
    action: 'system_settings_change',
    category: ActivityCategory.ADMINISTRATIVE,
    importance: ActivityImportance.HIGH,
    description: 'System settings changed',
    shouldLog: true,
  },

  // System Jobs
  'job_pra_scan_trigger': {
    action: 'job_pra_scan_trigger',
    category: ActivityCategory.SYSTEM,
    importance: ActivityImportance.MEDIUM,
    description: 'PRA scan triggered',
    shouldLog: true,
  },
  'job_analytics_refresh': {
    action: 'job_analytics_refresh',
    category: ActivityCategory.SYSTEM,
    importance: ActivityImportance.MEDIUM,
    description: 'Analytics refresh triggered',
    shouldLog: true,
  },
  'job_cleanup_trigger': {
    action: 'job_cleanup_trigger',
    category: ActivityCategory.SYSTEM,
    importance: ActivityImportance.MEDIUM,
    description: 'Cleanup job triggered',
    shouldLog: true,
  },

  // Security Events
  'unauthorized_access': {
    action: 'unauthorized_access',
    category: ActivityCategory.SECURITY,
    importance: ActivityImportance.HIGH,
    description: 'Unauthorized access attempt',
    shouldLog: true,
  },
  'rate_limit_exceeded': {
    action: 'rate_limit_exceeded',
    category: ActivityCategory.SECURITY,
    importance: ActivityImportance.HIGH,
    description: 'Rate limit exceeded',
    shouldLog: true,
  },
  'suspicious_activity': {
    action: 'suspicious_activity',
    category: ActivityCategory.SECURITY,
    importance: ActivityImportance.HIGH,
    description: 'Suspicious activity detected',
    shouldLog: true,
  },

  // Activities to SKIP (Noise)
  'profile_view': {
    action: 'profile_view',
    category: ActivityCategory.ACCOUNT,
    importance: ActivityImportance.NOISE,
    description: 'Profile viewed',
    shouldLog: false,
  },
  'activity_view': {
    action: 'activity_view',
    category: ActivityCategory.ACCOUNT,
    importance: ActivityImportance.NOISE,
    description: 'Activity history viewed',
    shouldLog: false,
  },
  'hospitals_view': {
    action: 'hospitals_view',
    category: ActivityCategory.DATA,
    importance: ActivityImportance.NOISE,
    description: 'Hospitals list viewed',
    shouldLog: false,
  },
  'prices_view': {
    action: 'prices_view',
    category: ActivityCategory.DATA,
    importance: ActivityImportance.NOISE,
    description: 'Prices list viewed',
    shouldLog: false,
  },
  'analytics_view': {
    action: 'analytics_view',
    category: ActivityCategory.DATA,
    importance: ActivityImportance.NOISE,
    description: 'Analytics viewed',
    shouldLog: false,
  },
  'notifications_view': {
    action: 'notifications_view',
    category: ActivityCategory.ACCOUNT,
    importance: ActivityImportance.NOISE,
    description: 'Notifications viewed',
    shouldLog: false,
  },
  'auth_refresh': {
    action: 'auth_refresh',
    category: ActivityCategory.AUTHENTICATION,
    importance: ActivityImportance.NOISE,
    description: 'Token refreshed',
    shouldLog: false,
  },
  'users_view': {
    action: 'users_view',
    category: ActivityCategory.DATA,
    importance: ActivityImportance.NOISE,
    description: 'Users list viewed',
    shouldLog: false,
  },
  'jobs_view': {
    action: 'jobs_view',
    category: ActivityCategory.DATA,
    importance: ActivityImportance.NOISE,
    description: 'Jobs list viewed',
    shouldLog: false,
  },
  'status_view': {
    action: 'status_view',
    category: ActivityCategory.SYSTEM,
    importance: ActivityImportance.NOISE,
    description: 'Status viewed',
    shouldLog: false,
  },
  'stats_view': {
    action: 'stats_view',
    category: ActivityCategory.DATA,
    importance: ActivityImportance.NOISE,
    description: 'Statistics viewed',
    shouldLog: false,
  },
  'files_list_view': {
    action: 'files_list_view',
    category: ActivityCategory.DATA,
    importance: ActivityImportance.NOISE,
    description: 'Files list viewed',
    shouldLog: false,
  },
  'page_view': {
    action: 'page_view',
    category: ActivityCategory.SYSTEM,
    importance: ActivityImportance.NOISE,
    description: 'Page viewed',
    shouldLog: false,
  },
  'session_start': {
    action: 'session_start',
    category: ActivityCategory.AUTHENTICATION,
    importance: ActivityImportance.LOW,
    description: 'Session started',
    shouldLog: true,
  },
};

// Helper function to check if an action should be logged
export function shouldLogActivity(action: string): boolean {
  const config = ACTIVITY_CONFIG[action];
  return config?.shouldLog !== false;
}

// Helper function to get activity config
export function getActivityConfig(action: string): ActivityConfig | undefined {
  return ACTIVITY_CONFIG[action];
}

// Default config for unknown actions
export const DEFAULT_ACTIVITY_CONFIG: ActivityConfig = {
  action: 'unknown',
  category: ActivityCategory.SYSTEM,
  importance: ActivityImportance.LOW,
  description: 'Unknown action',
  shouldLog: false, // Don't log unknown actions by default
};