import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // 🛑 This line fixes the "Invalid hook call" error by forcing a single React instance
    dedupe: ['react', 'react-dom'],
  },
})