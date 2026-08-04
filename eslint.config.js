import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Unused args are legal in Express middleware: the 4-arity error handler
      // must declare `next` even when it never calls it.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // eslint-config-prettier last: it turns off stylistic rules that would
  // otherwise fight `npm run format`.
  prettier,
);
