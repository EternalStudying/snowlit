import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    target: 'es2022'
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022'
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    // Tests never load the real map SDK; the map shows its placeholder.
    env: { VITE_AMAP_KEY: '' }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080'
    }
  }
});
