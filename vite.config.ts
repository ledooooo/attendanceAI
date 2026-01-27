import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'نظام حضور الموظفين',
        short_name: 'الحضور والانصراف',
        description: 'نظام إدارة الحضور والانصراف بمركز غرب المطار',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // 🔥 أهم إعدادات للأوفلاين
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'], // الملفات المراد تخزينها
        runtimeCaching: [
          {
            // تخزين الخطوط والصور من جوجل أو مصادر خارجية
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // سنة كاملة
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // تخزين الصور المحملة من Supabase (صور الموظفين)
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: 'StaleWhileRevalidate', // عرض الصورة القديمة ثم تحديثها في الخلفية
            options: {
              cacheName: 'supabase-images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // أسبوع
              }
            }
          }
        ]
      }
    })
  ],
});
