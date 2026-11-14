import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5180, strictPort: true },
  preview: { port: 5180, strictPort: true },
  worker: { format: 'es' },
  build: { target: 'es2022', assetsInlineLimit: 0 },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
} as any);
