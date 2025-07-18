// Global test setup for E2E tests
import 'reflect-metadata';

// Increase timeout for E2E tests
jest.setTimeout(30000);

// Mock external dependencies that might cause issues in tests
jest.mock('../src/database/database.service');
jest.mock('../src/storage/storage.service');