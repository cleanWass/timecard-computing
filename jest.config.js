/** @type {import('jest').Config} */
const config = {
  verbose: true,
  testPathIgnorePatterns: ['/build'],
  moduleNameMapper: {
    '@application/(.*)': '<rootDir>/src/application/$1',
    '@domain/(.*)': '<rootDir>/src/domain/$1',
    '@infrastructure/(.*)': '<rootDir>/src/infrastructure/$1',
    '@shared/(.*)': '<rootDir>/src/~shared/$1',
    '@test/(.*)': '<rootDir>/test/$1',
  },
};

module.exports = config;
