import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development the browser talks to Vite, and Vite forwards /api to the PocketSend server.
// That keeps the session cookie same-origin, so there is no CORS to set up.
const api = process.env.API_URL ?? 'http://localhost:3001'

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': api } },
})
