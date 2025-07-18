import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set up global test configuration
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Increase test timeout for integration tests
jest.setTimeout(30000);