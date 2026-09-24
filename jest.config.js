/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['js', 'json', 'node'],
  testMatch: ['**/*.test.js'],
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageThreshold: { global: { statements: 100, branches: 100, functions: 100, lines: 100 } },
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/scripts/**', '!src/**/*.test.js'],
};
