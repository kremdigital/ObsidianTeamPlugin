/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: ['**/*.{test,spec}.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // The `obsidian` package ships ESM-only types. Tests should not import the
    // real Obsidian runtime — use the manual mock at __mocks__/obsidian.ts.
    '^obsidian$': '<rootDir>/tests/__mocks__/obsidian.ts',
    // chokidar 5+ is pure ESM and ts-jest can't load it directly. Tests
    // inject their own factory; the mock only has to make the import resolve.
    '^chokidar$': '<rootDir>/tests/__mocks__/chokidar.ts',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: { module: 'ESNext' } }],
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/*.d.ts'],
};
