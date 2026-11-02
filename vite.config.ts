import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: false,
    allowedHosts: true,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          map: ['maplibre-gl'],
          charts: ['recharts'],
          motion: ['framer-motion'],
          geo: ['geotiff'],
          pdf: ['jspdf'],
        },
      },
    },
  },
});
