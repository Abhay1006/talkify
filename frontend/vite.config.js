import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
