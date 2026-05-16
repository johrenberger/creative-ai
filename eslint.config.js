import globals from 'globals';
import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';

export default [
  {
    ignores: [
      'node_modules/**',
      'db/**',
      'coverage/**',
      'public/**',
      'dist/**',
      '*.config.js'
    ]
  },
  eslint.configs.recommended,
  {
    plugins: {
      '@stylistic': stylistic
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      },
      sourceType: 'module',
      ecmaVersion: 2024
    },
    rules: {
      'no-dupe-keys': 'off',
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      'no-console': 'off',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'indent': ['error', 2],
      'comma-dangle': ['error', 'never'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'max-len': ['error', { code: 145, ignoreUrls: true, ignoreComments: true, ignoreStrings: true, ignoreTemplateLiterals: true }],
      'no-trailing-spaces': 'error',
      'eol-last': ['error', 'always'],
      'keyword-spacing': 'error',
      'space-before-blocks': 'error',
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/indent': ['error', 2]
    }
  }
];