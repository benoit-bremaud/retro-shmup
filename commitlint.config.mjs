// Conventional Commits with the project's scopes (CONTRIBUTING.md).
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Subjects may start with an acronym ("ADR-0012 …", "UML …").
    'subject-case': [0],
    'scope-empty': [2, 'never'],
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
