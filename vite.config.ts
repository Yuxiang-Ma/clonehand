import { defineConfig } from 'vite';

// `vite build` makes the client for the Python service (dist/). `vite build --mode demo` makes a
// static site (dist-demo/) that runs MuJoCo in the browser and reads the files that
// scripts/export_web_demo.py writes to .demo-data/.
export default defineConfig(({ mode }) => {
  const demo = mode === 'demo';
  return {
    base: demo ? './' : '/',
    publicDir: demo ? '.demo-data' : false,
    build: {
      outDir: demo ? 'dist-demo' : 'dist',
      // Two pages: the simulator and the anatomy inventory reference.
      rollupOptions: {
        input: { main: 'index.html', anatomy: 'anatomy.html' },
        // Three.js changes far less often than the app, so it gets its own long-cached chunk.
        output: { manualChunks: { three: ['three', 'three/addons/controls/OrbitControls.js'] } },
      },
    },
    worker: { format: 'es' },
    // The service build swaps the worker link for a stub so it ships no worker or WebAssembly.
    resolve: demo ? {} : {
      alias: [{ find: /^\.\/worker-link$/, replacement: new URL('./src/gui/worker-link.stub.ts', import.meta.url).pathname }],
    },
    // The emscripten loader finds mujoco.wasm next to itself; pre-bundling would move it.
    optimizeDeps: { exclude: ['mujoco'] },
    server: {
      proxy: {
        '/api': 'http://127.0.0.1:8000',
        '/ws': { target: 'ws://127.0.0.1:8000', ws: true },
      },
    },
  };
});
