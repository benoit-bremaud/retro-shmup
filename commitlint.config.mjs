// Conventional Commits with the project's scopes (CONTRIBUTING.md).
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'design',
        'adr',
        'uml',
        'docs',
        'ci',
        'repo',
        'deps',
        'engine',
        'game',
        'render',
        'audio',
        'input',
        'ui',
        'levels',
        'assets',
        'i18n',
        'tests',
      ],
    ],
  },
};
