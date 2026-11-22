import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  test: {
    // Playwright owns tests/e2e (`npm run test:e2e`); Vitest must never
    // collect its *.spec.ts files.
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
});
