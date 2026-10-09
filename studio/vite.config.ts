import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // The version shown on My account. Defined on import.meta.env because Vite 8's
  // dev server no longer replaces custom globals like __APP_VERSION__.
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version ?? 'dev') },
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
        background_color: '#FFFFFF',
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
  // The Claude preview passes a free port in PORT when 5173 is already taken.
  server: { port: Number(process.env.PORT) || 5173, strictPort: true },
  test: {
    include: ['src/**/*.test.ts', 'supabase/tests/**/*.test.ts'],
  },
});
