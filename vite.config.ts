import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// import { VitePWA } from 'vite-plugin-pwa'; // ❌ عطّله مؤقتاً

export default defineConfig({
  plugins: [
    react(),
    // ❌ عطّل VitePWA لأنه بيعمل conflict مع sw.js اليدوي
    /*
    VitePWA({
      registerType: 'autoUpdate',
      ...
    })
    */
  ],
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
