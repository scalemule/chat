import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Per-file `// @vitest-environment jsdom` pragmas continue to work;
    // this setup file runs once per worker for jsdom-environment tests.
    setupFiles: ['./src/react-components/__tests__/setup.ts'],
  },
});
