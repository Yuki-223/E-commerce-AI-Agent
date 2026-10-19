/// <reference types="vitest" />
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Compile-time flag so builds without VITE_USE_MOCK=1 tree-shake the whole mock layer.
  define: {
    __USE_MOCK__: JSON.stringify((process.env.VITE_USE_MOCK ?? loadEnv(mode, process.cwd(), 'VITE_').VITE_USE_MOCK) === '1'),
  },
  // Pre-bundle up front so a newly discovered dep never forces a reload with a second React copy.
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'react-router-dom', '@tanstack/react-query', 'zustand', 'idb'],
  },
  server: {
    port: 5173,
    // The mock layer imports product JSON and images from ../data and ../backend.
    fs: { allow: [repoRoot] },
    // backend/api/main.py has no CORSMiddleware, so the dev server proxies /api instead.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
}))
