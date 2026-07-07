/// <reference types="vitest/config" />
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only comment store: the browser can't write files, so the dev server
// owns ggg-viz/comments.json. GET returns all comments; POST appends one
// (id/at/status assigned here). The file is committed — comments are design
// artifacts a review session reads and replies to.
function commentsApi(): Plugin {
  const file = fileURLToPath(new URL('./comments.json', import.meta.url))
  const load = (): unknown[] => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [])
  return {
    name: 'ggg-comments-api',
    configureServer(server) {
      server.middlewares.use('/api/comments', (req, res) => {
        res.setHeader('content-type', 'application/json')
        if (req.method === 'GET') {
          res.end(JSON.stringify(load()))
          return
        }
        if (req.method === 'POST') {
          const chunks: Buffer[] = []
          req.on('data', (c: Buffer) => chunks.push(c))
          req.on('end', () => {
            try {
              const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
              if (typeof body?.text !== 'string' || !body.text.trim() || typeof body?.scenarioId !== 'string') {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'text and scenarioId required' }))
                return
              }
              const all = load()
              const comment = {
                id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                at: new Date().toISOString(),
                status: 'open',
                ...body,
                text: body.text.trim(),
              }
              all.push(comment)
              writeFileSync(file, JSON.stringify(all, null, 2) + '\n')
              res.end(JSON.stringify(all))
            } catch {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'bad json' }))
            }
          })
          return
        }
        res.statusCode = 405
        res.end(JSON.stringify({ error: 'method not allowed' }))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), commentsApi()],
  resolve: { dedupe: ['react', 'react-dom'] },
  optimizeDeps: { exclude: ['@owebeeone/grip-react'] },
  test: { include: ['src/**/*.test.{ts,tsx}'] },
})
