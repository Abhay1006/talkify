import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Installable app + push notifications. Our own service worker (src/sw.js)
    // so it can handle push; workbox injects the precache list into it.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt',
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,webp,mp3,woff2}'],
        // The background image is large and decorative; fetched normally.
        globIgnores: ['**/wall3.png'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: 'Talkify',
        short_name: 'Talkify',
        description: 'Real-time chat with voice and video calls.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0B0E1A',
        theme_color: '#0B0E1A',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
      },
      // Proxied so the socket is same-origin in development too. That keeps the
      // jwt cookie flowing on the handshake without any CORS configuration, and
      // makes dev match production exactly.
      '/socket.io': {
        target: 'http://localhost:5001',
        ws: true,
      },
    },
  },
})
