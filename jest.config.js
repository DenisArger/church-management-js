/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  modulePathIgnorePatterns: ["<rootDir>/dist"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "netlify/functions/**/*.ts",
    "!**/*.test.ts",
    "!**/types/**",
  ],
  moduleNameMapper: {},
  roots: ["<rootDir>/src", "<rootDir>/netlify"],
};
