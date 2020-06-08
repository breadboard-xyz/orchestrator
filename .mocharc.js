'use strict';

// Here's a JavaScript-based config file.
// If you need conditional logic, you might want to use this type of config.
// Otherwise, JSON or YAML is recommended.

module.exports = {
  diff: true,
  extension: ['js', 'ts'],
  "spec": "test/**/*.ts",
  package: './package.json',
  reporter: 'spec',
  slow: 75,
  timeout: 2000,
  ui: 'bdd',
  'watch-files': ['lib/**/*.ts', 'test/**/*.ts'],
  'watch-ignore': ['lib/vendor'],
  "require": "ts-node/register"
};