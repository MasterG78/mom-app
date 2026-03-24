import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    nodePolyfills(),
  ],
  resolve: {
    // 🛑 This line fixes the "Invalid hook call" error by forcing a single React instance
    dedupe: ['react', 'react-dom'],
  },
})