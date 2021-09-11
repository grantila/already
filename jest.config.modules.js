const cjsConfig = require( './jest.config.common' );

module.exports = Object.assign( { }, cjsConfig, {
  moduleFileExtensions: ["js", "ts", "mjs"],
  testMatch: [
    ...cjsConfig.testMatch,
    "<rootDir>/test-out-mjs/**/*.js",
    "<rootDir>/test-out-mjs/**/*.mjs"
  ],
  collectCoverageFrom: [
    ...cjsConfig.collectCoverageFrom,
    "<rootDir>/dist-mjs/**/*.js"
  ],
} );
