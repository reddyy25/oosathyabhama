import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createApiMiddleware } from './api/_lib/dev-middleware.js';

// Serves the serverless functions in /api (Cloudinary signing/deleting) while you run `npm run dev` on localhost.
// On Vercel the same files run as real serverless functions.
function localApi() {
  return {
    name: 'local-api',
    config(_, { mode }) {
      const env = loadEnv(mode, process.cwd(), ''); // server-only values such as CLOUDINARY_API_SECRET stay in Node, never in the browser bundle
      for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;
    },
    configureServer(server) { server.middlewares.use(createApiMiddleware(process.cwd())); },
    configurePreviewServer(server) { server.middlewares.use(createApiMiddleware(process.cwd())); },
  };
}

export default defineConfig({ plugins: [react(), localApi()], server: { host: '0.0.0.0' }, build: { outDir: 'dist' } });
