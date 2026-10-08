// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Browser and clock APIs the domain must never touch (ADR-0002, ADR-0003, ADR-0009).
const BROWSER_GLOBALS = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'performance',
  'requestAnimationFrame',
  'setTimeout',
  'setInterval',
  'AudioContext',
  'fetch',
].map((name) => ({ name, message: 'The domain never uses browser APIs: go through a port.' }));

export default defineConfig(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.mjs', 'commitlint.config.mjs'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Code execution from data (security-policy INJ-4).
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-restricted-syntax': [
        'error',
        // Named exports only (owner rule).
        { selector: 'ExportDefaultDeclaration', message: 'Use named exports only.' },
        // HTML injection sinks (security-policy INJ-3): the game draws on a canvas only.
        {
          selector: 'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]',
          message: 'No HTML injection sink: build DOM nodes or draw on the canvas (INJ-3).',
        },
        {
          selector: 'CallExpression[callee.property.name=/^(insertAdjacentHTML|write|writeln)$/]',
          message: 'No HTML injection sink: build DOM nodes or draw on the canvas (INJ-3).',
        },
      ],
    },
  },
  {
    // Tool configuration files must export a default object.
    files: ['*.config.ts', '*.config.mjs'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    // Plain JavaScript configuration files are not type-checked.
    files: ['**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...BROWSER_GLOBALS],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Inject a Clock (ADR-0002).' },
        { object: 'Math', property: 'random', message: 'Inject a seeded Random (ADR-0002).' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/adapters/**', '**/app/**'],
              message: 'The domain depends only on its ports (ADR-0003).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/adapters/**/*.ts'],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/app/**'], message: 'Adapters never import the composition root.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['*.config.ts', '*.config.mjs'],
    languageOptions: { globals: globals.node },
  },
);
