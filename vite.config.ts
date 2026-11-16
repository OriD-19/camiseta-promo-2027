/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';

const root = import.meta.dirname;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, '');
  return {
    base: env.VITE_BASE || '/',
    build: {
      target: 'es2022',
      rollupOptions: {
        input: {
          index: resolve(root, 'index.html'),
          resultados: resolve(root, 'resultados.html'),
        },
      },
    },
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
    },
  };
});
