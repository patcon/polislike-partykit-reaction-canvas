import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'public/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'app/client.tsx',
      output: {
        entryFileNames: 'client.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'client.css'
          }
          return '[name].[ext]'
        }
      }
    }
  },
  publicDir: false, // Don't copy public dir since we're building into it
  base: './', // Use relative paths for GitHub Pages
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
    ...(env.PARTYKIT_HOST && {
      'process.env.PARTYKIT_HOST': JSON.stringify(env.PARTYKIT_HOST)
    })
  }
}})