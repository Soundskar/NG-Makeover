import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'NG Studio',
        short_name: 'NG Studio',
        description: 'Namita Garg Makeover: academy and salon',
        lang: 'en-IN',
        theme_color: '#FFFFFF',
        background_color: '#F6F5F3',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only. Data always comes live from Supabase.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
  test: {
    include: ['src/**/*.test.ts', 'supabase/tests/**/*.test.ts'],
  },
});
