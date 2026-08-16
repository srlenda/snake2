import { PrismaClient } from '@prisma/client'

// Padrão serverless-friendly: reusa a mesma instância do PrismaClient entre
// invocações "quentes" da função, evitando esgotar o pool de conexões do banco.
// Na Vercel cada serverless function pode reutilizar o globalThis entre
// chamadas enquanto estiver "morna".
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Log de queries só em desenvolvimento (evita ruído em produção)
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
