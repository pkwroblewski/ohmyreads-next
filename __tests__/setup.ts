/**
 * Vitest global setup file
 * Configures test environment before each test runs
 */

import { afterEach, vi } from "vitest";

// Clean up mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Mock environment variables for tests
vi.stubEnv("NODE_ENV", "test");
