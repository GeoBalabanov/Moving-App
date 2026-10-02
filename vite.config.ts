import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // localhost is a secure context, so getUserMedia works without HTTPS.
    host: 'localhost',
    port: 5173,
  },
  build: {
    // Rapier inlines its WASM (~2 MB), so the main chunk is large by design.
    chunkSizeWarningLimit: 6000,
  },
  optimizeDeps: {
    // Rapier ships its WASM inlined; pre-bundling it is unnecessary and slow.
    exclude: ['@dimforge/rapier3d-compat'],
  },
});
