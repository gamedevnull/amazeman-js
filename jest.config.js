const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  moduleNameMapper: {
    'audio\\.js$': '<rootDir>/tests/__mocks__/audio.ts',
    '^(.*)\\.js$': '$1',
  },
};