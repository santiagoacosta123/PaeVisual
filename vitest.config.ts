import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@env': path.resolve(__dirname, './src/environments'),
      '@core': path.resolve(__dirname, './src/app/core'),
      '@shared': path.resolve(__dirname, './src/app/shared'),
      '@features': path.resolve(__dirname, './src/app/features'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: true,
    restoreMocks: true,
  },
});
