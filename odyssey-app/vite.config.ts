import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { saveSessionPlugin } from './server/save-session'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load ALL env vars ('' prefix = include non-VITE_ vars too)
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), saveSessionPlugin()],
    server: {
      proxy: {
        // Proxy Vercel AI Gateway calls — auth injected server-side
        '/api/gateway': {
          target: 'https://ai-gateway.vercel.sh',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/gateway/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              // Inject auth from server-side env (never exposed to browser)
              // Works with: vercel dev (OIDC), or AI_GATEWAY_API_KEY in .env
              const token =
                env.VERCEL_OIDC_TOKEN ||
                env.AI_GATEWAY_API_KEY ||
                process.env.VERCEL_OIDC_TOKEN
              if (token) {
                proxyReq.setHeader('Authorization', `Bearer ${token}`)
              }
            })
          },
        },
      },
    },
  }
})
