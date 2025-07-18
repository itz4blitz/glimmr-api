// Export all schemas
export * from './hospitals';
export * from './prices';
export * from './price-transparency-files';
export * from './analytics';
export * from './jobs';
export * from './users';

// Re-export for convenience
import { hospitals } from './hospitals';
import { prices } from './prices';
import { priceTransparencyFiles } from './price-transparency-files';
import { analytics } from './analytics';
import { jobs, jobLogs } from './jobs';
import { users } from './users';

export const schema = {
  hospitals,
  prices,
  priceTransparencyFiles,
  analytics,
  jobs,
  jobLogs,
  users,
};

export type Schema = typeof schema;
