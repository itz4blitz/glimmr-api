// Global test setup
import { config } from "dotenv";

// Load test environment variables
config({ path: ".env.test" });

// Increase timeout for e2e tests
jest.setTimeout(30000);

// Mock console.error to reduce noise in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("JWT") ||
        args[0].includes("Unauthorized") ||
        args[0].includes("authentication"))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
