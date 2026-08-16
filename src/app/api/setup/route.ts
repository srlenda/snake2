import { NextResponse } from 'next/server'
import { createClient } from '@libsql/client'

export const dynamic = 'force-dynamic'

// GET /api/setup — cria a tabela Score no banco Turso automaticamente.
// Rode UMA VEZ após o primeiro deploy: https://seu-app.vercel.app/api/setup
// Pode rodar quantas vezes quiser (usa IF NOT EXISTS).
export async function GET() {
  const url = process.env.DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN
  if (!url) {
    return NextResponse.json(
      { ok: false, error: 'DATABASE_URL não configurada. Adicione as variáveis de ambiente na Vercel.' },
      { status: 500 },
    )
  }

  try {
    const client = createClient({ url, authToken })

    // Cria a tabela Score (idêntica ao schema do Prisma)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS "Score" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "playerName" TEXT NOT NULL,
        "score" INTEGER NOT NULL,
        "mode" TEXT NOT NULL,
        "players" INTEGER NOT NULL,
        "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Cria o índice para consultas rápidas por (mode, players, score desc)
    await client.execute(`
      CREATE INDEX IF NOT EXISTS "Score_mode_players_score_idx"
      ON "Score" ("mode", "players", "score" DESC)
    `)

    return NextResponse.json({
      ok: true,
      message: 'Banco configurado! Tabela Score criada com sucesso.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    )
  }
}
