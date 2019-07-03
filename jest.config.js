module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: [
    "<rootDir>/test-out-es5/**/*.js",
    "<rootDir>/test-out/**/*.js",
    "<rootDir>/test/**/*.ts",
  ],
  modulePathIgnorePatterns: [
    ".*\.d\.ts"
  ],
  collectCoverageFrom: ["<rootDir>/dist/**/*.js"],
  coverageReporters: ["lcov", "text", "html"],
  setupFiles: [
    "trace-unhandled/register",
  ],
  maxConcurrency: Infinity,
};
