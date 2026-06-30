import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { parse } from 'node:url'
import { getCategoryNews } from './api/_lib/fetchNews.js'

// Mirrors api/news.js so `npm run dev` can serve /api/news without the Vercel CLI.
function apiNewsDevMiddleware() {
  return {
    name: 'api-news-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/news', async (req, res) => {
        const { query } = parse(req.url, true)
        const category = query.category
        res.setHeader('Content-Type', 'application/json')

        if (!category) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: "Missing required 'category' query parameter" }))
          return
        }

        try {
          const items = await getCategoryNews(category)
          if (items === null) {
            res.statusCode = 404
            res.end(JSON.stringify({ error: `Unknown category: ${category}` }))
            return
          }
          res.statusCode = 200
          res.end(JSON.stringify({ items }))
        } catch {
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Failed to fetch news' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiNewsDevMiddleware()],
})
