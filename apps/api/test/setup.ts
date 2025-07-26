import { config } from "dotenv";

// Load test environment variables
config({ path: ".env.test" });

// Set up global test configuration
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

// Increase test timeout for integration tests
jest.setTimeout(30000);
// Global test setup for E2E tests
import "reflect-metadata";

// Increase timeout for E2E tests
jest.setTimeout(30000);

// Mock external dependencies that might cause issues in tests
jest.mock("../src/database/database.service");
jest.mock("../src/storage/storage.service");
