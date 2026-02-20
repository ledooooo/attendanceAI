import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    // ✅ تأكد إن الملفات من public بتتنسخ
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  // ✅ ضمان نسخ كل حاجة من public
  publicDir: 'public'
});
