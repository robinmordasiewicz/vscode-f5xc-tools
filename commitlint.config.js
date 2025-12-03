// Commitlint configuration
// See https://commitlint.js.org/reference/configuration.html

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Type rules
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation only changes
        'style', // Changes that don't affect meaning (whitespace, formatting)
        'refactor', // Code change that neither fixes a bug nor adds a feature
        'perf', // Performance improvement
        'test', // Adding or correcting tests
        'build', // Changes to build system or dependencies
        'ci', // CI/CD configuration changes
        'chore', // Other changes that don't modify src or test files
        'revert', // Reverts a previous commit
        'security', // Security improvements
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],

    // Scope rules
    'scope-case': [2, 'always', 'lower-case'],
    'scope-enum': [
      1,
      'always',
      [
        'api', // API client changes
        'auth', // Authentication changes
        'commands', // Command implementations
        'config', // Configuration changes
        'deps', // Dependency updates
        'tree', // Tree view providers
        'profiles', // Profile management
        'ui', // User interface changes
        'utils', // Utility functions
        'release', // Release related changes
      ],
    ],

    // Subject rules
    'subject-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-min-length': [2, 'always', 10],
    'subject-max-length': [2, 'always', 72],

    // Header rules
    'header-max-length': [2, 'always', 100],

    // Body rules
    'body-leading-blank': [2, 'always'],
    'body-max-line-length': [2, 'always', 100],

    // Footer rules
    'footer-leading-blank': [2, 'always'],
    'footer-max-line-length': [2, 'always', 100],
  },
  // Custom help message
  helpUrl: 'https://www.conventionalcommits.org/',
};
