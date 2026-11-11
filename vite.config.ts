import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createComposeApiHandler } from './scripts/compose-cli';

/** Монтирует /api/health, /api/smoke, /api/compose в dev- и preview-сервер Vite */
function composeApiPlugin(): Plugin {
  return {
    name: 'ochen-compose-api',
    configureServer(server) {
      server.middlewares.use(createComposeApiHandler());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createComposeApiHandler());
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), composeApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
