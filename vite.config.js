import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
// import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: './dist-vite'
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        cacheId: 'blockbench',
        globDirectory: './',
        globPatterns: [
          './index.html',
          './favicon.png',
          './icon_maskable.png',

          './js/**/*',
          './bundle.js',
          './lib/**/*',
          './css/**/*',
          './assets/**/*',
          './font/*',
        ],
        swDest: './service_worker.js',
        maximumFileSizeToCacheInBytes: 4_096_000,
        sourcemap: false
      }
      
    })
    //vue(),
  ],
  /*
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
    */
})
