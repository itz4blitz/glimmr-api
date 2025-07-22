# Comprehensive Auditing Strategy for Glimmr API

## Overview
This document outlines a comprehensive auditing strategy to track all user activities, system events, and data changes throughout the Glimmr application.

## Audit Event Categories

### 1. Authentication Events
- **login**: User successfully logs in
- **login_failed**: Failed login attempt
- **logout**: User logs out
- **session_expired**: User session expires
- **token_refresh**: JWT token refreshed
- **password_reset_requested**: Password reset email sent
- **password_reset_completed**: Password successfully reset
- **email_verification_sent**: Verification email sent
- **email_verified**: Email address verified

### 2. User Management Events
- **user_created**: New user account created
- **user_updated**: User profile updated
- **user_deleted**: User account deleted
- **user_activated**: User account activated
- **user_deactivated**: User account deactivated
- **role_changed**: User role modified
- **preferences_updated**: User preferences changed
- **profile_updated**: User profile information changed

### 3. Session & Navigation Events
- **page_view**: User navigates to a page
- **session_start**: New session begins
- **session_active**: Periodic session activity ping
- **api_request**: API endpoint accessed
- **route_change**: Frontend route navigation

### 4. Data Access Events
- **data_viewed**: User views specific data
- **data_exported**: User exports data
- **data_search**: User performs search
- **report_generated**: User generates report

### 5. Hospital & Price Data Events
- **hospital_viewed**: Hospital details accessed
- **hospital_created**: New hospital added
- **hospital_updated**: Hospital information modified
- **hospital_deleted**: Hospital removed
- **price_viewed**: Price data accessed
- **price_search**: Price search performed
- **price_export**: Price data exported

### 6. Job Management Events
- **job_triggered**: Background job manually triggered
- **job_viewed**: Job details viewed
- **job_cancelled**: Job cancelled by user
- **job_retried**: Failed job retried
- **queue_viewed**: Queue dashboard accessed

### 7. File Management Events
- **file_uploaded**: File uploaded
- **file_downloaded**: File downloaded
- **file_deleted**: File deleted
- **file_viewed**: File accessed/previewed

### 8. Administrative Events
- **admin_action**: Administrative action performed
- **system_config_changed**: System configuration modified
- **bulk_operation**: Bulk operation performed
- **security_event**: Security-related event

## Implementation Architecture

### 1. Activity Logging Service
```typescript
@Injectable()
export class ActivityLoggingService {
  async logActivity(data: {
    userId?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, any>;
    request?: Request;
  }): Promise<void> {
    // Extract additional context
    const ipAddress = this.extractIpAddress(data.request);
    const userAgent = data.request?.headers['user-agent'];
    const sessionId = data.request?.session?.id;
    
    // Log to database
    await this.db.insert(userActivityLogs).values({
      userId: data.userId,
      action: data.action,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      ipAddress,
      userAgent,
      sessionId,
      metadata: {
        ...data.metadata,
        timestamp: new Date().toISOString(),
        url: data.request?.url,
        method: data.request?.method,
      },
      timestamp: new Date(),
    });
  }
}
```

### 2. Global Interceptor for API Requests
```typescript
@Injectable()
export class ActivityLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // Log API request
    this.activityLogger.logActivity({
      userId: user?.id,
      action: 'api_request',
      metadata: {
        endpoint: request.url,
        method: request.method,
        query: request.query,
        body: this.sanitizeBody(request.body),
      },
      request,
    });
    
    return next.handle();
  }
}
```

### 3. Frontend Route Tracking
```typescript
// React Router integration
const ActivityTracker = () => {
  const location = useLocation();
  const { user } = useAuthStore();
  
  useEffect(() => {
    if (user) {
      apiClient.post('/activity/page-view', {
        page: location.pathname,
        referrer: document.referrer,
        metadata: {
          search: location.search,
          hash: location.hash,
        },
      });
    }
  }, [location, user]);
  
  return null;
};
```

### 4. Session Activity Tracking
```typescript
@Injectable()
export class SessionActivityService {
  @Cron('*/5 * * * *') // Every 5 minutes
  async trackActiveSessions() {
    const activeSessions = await this.getActiveSessions();
    
    for (const session of activeSessions) {
      await this.activityLogger.logActivity({
        userId: session.userId,
        action: 'session_active',
        metadata: {
          sessionId: session.id,
          duration: session.duration,
          lastActivity: session.lastActivityAt,
        },
      });
    }
  }
}
```

## Database Schema Enhancements

### 1. Enhanced Activity Logs Table
```sql
-- Add new columns to user_activity_logs
ALTER TABLE user_activity_logs ADD COLUMN session_id VARCHAR(255);
ALTER TABLE user_activity_logs ADD COLUMN page_url TEXT;
ALTER TABLE user_activity_logs ADD COLUMN referrer TEXT;
ALTER TABLE user_activity_logs ADD COLUMN duration_ms INTEGER;
ALTER TABLE user_activity_logs ADD COLUMN response_status INTEGER;
ALTER TABLE user_activity_logs ADD COLUMN error_code VARCHAR(50);

-- Add indexes for better query performance
CREATE INDEX idx_activity_session ON user_activity_logs(session_id);
CREATE INDEX idx_activity_page ON user_activity_logs(page_url);
CREATE INDEX idx_activity_action_timestamp ON user_activity_logs(action, timestamp);
```

### 2. Session Tracking Table
```sql
CREATE TABLE user_session_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(id),
  start_time TIMESTAMP NOT NULL DEFAULT NOW(),
  last_activity TIMESTAMP NOT NULL DEFAULT NOW(),
  end_time TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  pages_viewed INTEGER DEFAULT 0,
  actions_performed INTEGER DEFAULT 0,
  metadata JSONB
);
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
1. Create ActivityLoggingService
2. Implement global interceptor
3. Add database schema changes
4. Create base activity tracking

### Phase 2: Authentication & Session (Week 2)
1. Track all auth events
2. Implement session monitoring
3. Add session activity tracking
4. Create session dashboard

### Phase 3: CRUD Operations (Week 3)
1. Track all create operations
2. Track all update operations
3. Track all delete operations
4. Track all read/view operations

### Phase 4: Frontend Integration (Week 4)
1. Add route tracking
2. Implement page view analytics
3. Add user action tracking
4. Create activity timeline UI

### Phase 5: Analytics & Reporting (Week 5)
1. Create activity dashboard
2. Add filtering and search
3. Implement activity exports
4. Create audit reports

## Activity Logging Best Practices

### 1. What to Log
- User identification (userId, email)
- Action performed
- Resource affected
- Timestamp
- IP address and user agent
- Success/failure status
- Error details (if failed)
- Request/response metadata

### 2. What NOT to Log
- Passwords or sensitive credentials
- Full credit card numbers
- Personal health information (PHI)
- Full request/response bodies for large payloads
- Internal system secrets

### 3. Data Retention
- Keep high-level activity logs for 2 years
- Keep detailed logs for 90 days
- Archive older logs to cold storage
- Implement log rotation and cleanup

### 4. Performance Considerations
- Use async logging to avoid blocking requests
- Batch insert logs when possible
- Use appropriate indexes
- Consider using a dedicated logging database
- Implement log sampling for high-traffic endpoints

## Security & Privacy

### 1. Data Protection
- Encrypt sensitive metadata
- Use secure connections for log transmission
- Implement access controls on audit logs
- Regular security audits of logging system

### 2. Compliance
- GDPR: Allow users to request their activity data
- HIPAA: Ensure PHI is not logged
- SOC2: Maintain audit trail integrity
- PCI: Mask payment-related data

### 3. Access Control
- Only admins can view full audit logs
- Users can view their own activity
- Implement role-based access
- Log access to audit logs

## Monitoring & Alerts

### 1. Suspicious Activity Detection
- Multiple failed login attempts
- Unusual access patterns
- Bulk data exports
- Off-hours administrative actions

### 2. System Health Monitoring
- Track API response times
- Monitor error rates
- Detect performance degradation
- Track resource usage

### 3. Alert Conditions
- Failed login threshold exceeded
- Unauthorized access attempts
- System errors spike
- Unusual user behavior patterns

## Sample Activity Queries

### 1. User Activity Timeline
```sql
SELECT * FROM user_activity_logs
WHERE user_id = ?
ORDER BY timestamp DESC
LIMIT 100;
```

### 2. Failed Login Attempts
```sql
SELECT COUNT(*), ip_address, user_agent
FROM user_activity_logs
WHERE action = 'login_failed'
  AND timestamp > NOW() - INTERVAL '1 hour'
GROUP BY ip_address, user_agent
HAVING COUNT(*) > 5;
```

### 3. Most Active Users
```sql
SELECT user_id, COUNT(*) as activity_count
FROM user_activity_logs
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY user_id
ORDER BY activity_count DESC
LIMIT 20;
```

### 4. Page View Analytics
```sql
SELECT page_url, COUNT(*) as views
FROM user_activity_logs
WHERE action = 'page_view'
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY page_url
ORDER BY views DESC;
```

## Next Steps

1. Review and approve this strategy
2. Create detailed technical specifications
3. Implement Phase 1 infrastructure
4. Test with pilot group
5. Roll out incrementally
6. Monitor and optimize