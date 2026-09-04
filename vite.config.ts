import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  plugins: [
    vue(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['better-sqlite3', 'screenshot-desktop']
            }
          }
        }
      },
      preload: {
        input: 'electron/preload.ts'
      }
    }),
    renderer()
  ],
  build: {
    outDir: 'dist'
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/tesseract/**']
    }
  }
})
