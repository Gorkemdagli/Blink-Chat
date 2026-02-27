import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
    server: {
      deps: {
        inline: ['@exodus/bytes', 'html-encoding-sniffer']
      }
    }
  },
} as any) // Cast to any if test config is not in standard UserConfig types without vitest types
