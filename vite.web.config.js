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
        registerType: 'prompt',
        manifest: {
          "short_name": "Blockbench",
          "name": "Blockbench",
          "icons": [
            {
              "src": "favicon.png",
              "type": "image/png",
              "sizes": "128x128"
            },
            {
              "src": "icon.png",
              "type": "image/png",
              "sizes": "1024x1024"
            },
            {
              "src": "icon_maskable.png",
              "type": "image/png",
              "sizes": "256x256",
              "purpose": "maskable"
            }
          ],
          "screenshots": [
            {
              "src": "content/front_page_app.png",
              "sizes": "1920x1040",
              "type": "image/png",
              "label": "Blockbench Interface"
            }
          ],
          "start_url": "./index.html",
          "background_color": "#21252b",
          "theme_color": "#3e90ff",
          "display": "standalone",
          "display_override": ["window-controls-overlay"],
          "orientation": "any"
        },
        manifestFilename: './manifest.webmanifest',
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
