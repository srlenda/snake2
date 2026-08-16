import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

// Padrão serverless-friendly: reusa a mesma instância do PrismaClient entre
// invocações "quentes" da função, evitando esgotar conexões.
// Turso (libSQL) usa driver adapter — compatível com Vercel serverless.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN
  if (!url) {
    throw new Error('DATABASE_URL não configurada')
  }
  const libsql = createClient({ url, authToken })
  const adapter = new PrismaLibSQL(libsql)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
