import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Served from https://<user>.github.io/cardio/ in production (GitHub Pages project site),
// but from the domain root during local dev.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/cardio/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Cardio Tracker',
        short_name: 'Cardio',
        description: 'Track runs and cardio, MPW, and training load for marathon training.',
        theme_color: '#7c3aed',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        // Relative to the manifest's own URL, so these resolve correctly whether the
        // app is served from the domain root (dev) or a /cardio/ subpath (GitHub Pages).
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      },
    }),
  ],
}))
