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
    globals: true
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080'
    }
  }
});
