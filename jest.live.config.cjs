/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/apps', '<rootDir>/libs'],
  testMatch: ['**/*.live.spec.ts'],
  setupFiles: ['<rootDir>/test/live-env.setup.cjs'],
  moduleDirectories: ['node_modules', '<rootDir>'],
  maxWorkers: 1,
  clearMocks: true,
};
