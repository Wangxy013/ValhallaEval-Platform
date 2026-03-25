import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const appBasePath = env.VITE_APP_BASE_PATH || (command === 'serve' ? '/' : '/tool/valhalla-eval/')
  const normalizedAppBasePath = appBasePath.endsWith('/') ? appBasePath : `${appBasePath}/`

  return {
    base: normalizedAppBasePath,
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
        '/valhalla-eval/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/valhalla-eval\/api/, '/api'),
        },
      },
    },
  }
})
