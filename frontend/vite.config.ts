import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    // Faster minification with esbuild instead of terser
    minify: 'esbuild',
    // Disable sourcemaps in production for smaller bundle
    sourcemap: false,
    // Optimize chunk sizes
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'ui': ['lucide-react', 'react-hot-toast'],
        },
      },
    },
    // Show detailed build info
    reportCompressedSize: false,
    // Increase chunk warning limit (32 component files)
    chunkSizeWarningLimit: 600,
    // Faster CSS processing
    cssCodeSplit: true,
    cssMinify: 'esbuild',
  },
  // Environment variable prefix
  envPrefix: 'VITE_',
})
