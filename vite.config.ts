import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Relative asset paths so the built app works when opened from the
  // filesystem inside Electron (file:// protocol), not just from a web server.
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
  },
})
