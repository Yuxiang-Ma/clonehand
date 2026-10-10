import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Two pages: the simulator and the anatomy inventory reference.
    rollupOptions: { input: { main: 'index.html', anatomy: 'anatomy.html' } },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/ws': { target: 'ws://127.0.0.1:8000', ws: true },
    },
  },
});
