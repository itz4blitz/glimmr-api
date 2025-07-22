import { SetMetadata } from '@nestjs/common';

export const SKIP_ACTIVITY_LOG = 'skipActivityLog';
export const ACTIVITY_ACTION = 'activityAction';
export const ACTIVITY_RESOURCE = 'activityResource';

/**
 * Decorator to skip activity logging for specific endpoints
 */
export const SkipActivityLog = () => SetMetadata(SKIP_ACTIVITY_LOG, true);

/**
 * Decorator to set custom activity action name
 */
export const ActivityAction = (action: string) => SetMetadata(ACTIVITY_ACTION, action);

/**
 * Decorator to set resource type for activity logging
 */
export const ActivityResource = (resource: string) => SetMetadata(ACTIVITY_RESOURCE, resource);