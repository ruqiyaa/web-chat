import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://127.0.0.1:5001',
        ws: true,
      },
      '/api': { target: 'http://127.0.0.1:5001'},

      '/avatars': { target: 'http://127.0.0.1:5001'},
    },
  },
})
