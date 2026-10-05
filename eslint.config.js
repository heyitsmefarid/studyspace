import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const serverOnlyAi = ['router', 'geminiProvider', 'groqProvider', 'tasks', 'guards'].flatMap((m) => [
  `@/services/ai/${m}`, `@/services/ai/${m}.ts`,
]);

export default tseslint.config(
  { ignores: ['dist', 'supabase/functions', 'supabase/.bundle', 'node_modules', '.superpowers'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-imports': ['error', {
        paths: serverOnlyAi.map((name) => ({ name, message: 'Server-only AI module. Use @/services/ai/aiService.' })),
        patterns: [{ group: ['**/services/ai/{router,geminiProvider,groqProvider,tasks,guards}*'], message: 'Server-only AI module. Use @/services/ai/aiService.' }],
      }],
    },
  },
  {
    files: ['src/services/ai/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['scripts/**/*.{js,mjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
);
