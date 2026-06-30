import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { parse } from 'node:url'
import newsHandler from './api/news.js'
import britBitHandler from './api/brit-bit.js'
import cronFetchHandler from './api/cron-fetch.js'
import cronBritBitHandler from './api/cron-brit-bit.js'

// Adapts a Vercel-style `(req, res)` handler (res.status().json()) to a
// plain Connect middleware so the same handler code runs under `npm run dev`
// and on Vercel.
function vercelHandlerMiddleware(handler) {
  return async (req, res) => {
    res.status = (code) => { res.statusCode = code; return res }
    res.json = (body) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)) }
    try {
      await handler(req, res)
    } catch (err) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: err.message }))
    }
  }
}

function apiDevMiddleware() {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/news', (req, res) => {
        const { query } = parse(req.url, true)
        req.query = query
        vercelHandlerMiddleware(newsHandler)(req, res)
      })
      server.middlewares.use('/api/brit-bit', vercelHandlerMiddleware(britBitHandler))
      // Lets `npm run dev` trigger the same fetch+summarise pipeline that
      // Vercel Cron runs in production, e.g. `curl -X POST localhost:5173/api/cron-fetch`.
      server.middlewares.use('/api/cron-fetch', vercelHandlerMiddleware(cronFetchHandler))
      server.middlewares.use('/api/cron-brit-bit', vercelHandlerMiddleware(cronBritBitHandler))
    },
  }
}

export default defineConfig(({ mode }) => {
  // Load .env into process.env so the dev middleware can read secrets.
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of ['ANTHROPIC_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET']) {
    if (env[key]) process.env[key] = env[key]
  }

  return {
    plugins: [react(), apiDevMiddleware()],
  }
})
