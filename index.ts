import app from './app'
import { createClient } from '@libsql/client'
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/libsql'

const server = Bun.serve({
  port: process.env.PORT || 4000,
  fetch: app.fetch,
})

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

export const db = drizzle({ client })

console.log('Server running', server.port)
