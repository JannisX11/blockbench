import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import conditionalImportPlugin from "vite-plugin-conditional-import";
import pkg from './package.json'

// import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {

  return {
    build: {
      outDir: './dist-vite'
    },
    define: {
      isApp: false,
      appVersion: '"'+pkg.version+'"'
    },
    plugins: [
      // vue(),
      conditionalImportPlugin({
        currentEnv: "browser",
        envs: ["electron", "browser"],
      }),
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
      }),
    ],
    clearScreen: false,
  }
})
