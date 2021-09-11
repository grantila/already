export default {
	// preset: "ts-jest",
	"transform": {
		"^.+\\.jsx?$": "babel-jest",
		"^.+\\.tsx?$": "ts-jest"
	},
	testEnvironment: "node",
	testMatch: [
		"<rootDir>/test-out/**/*.js",
		"<rootDir>/test/**/*.ts",
	],
	moduleFileExtensions: ["js", "ts", "mjs"],
	modulePathIgnorePatterns: [
		".*\.d\.ts"
	],
	collectCoverageFrom: [
		"<rootDir>/dist/**/*.js",
	],
	coverageReporters: ["lcov", "text", "html"],
	setupFiles: [
		"trace-unhandled/register",
	],
	maxConcurrency: Infinity,
}
