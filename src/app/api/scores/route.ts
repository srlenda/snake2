import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const VALID_MODES = ['classic', 'classic_wrap', 'special', 'time', 'maze'] as const
type ValidMode = (typeof VALID_MODES)[number]
function isValidMode(m: unknown): m is ValidMode {
  return typeof m === 'string' && (VALID_MODES as readonly string[]).includes(m)
}

// GET /api/scores?mode=classic&players=1&limit=10
// Retorna lista de scores ordenada por pontuação (desc).
// Em caso de erro de conexão com o banco, retorna lista vazia (não quebra o jogo).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode')
  const players = searchParams.get('players')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10) || 10, 50)

  const where: Record<string, unknown> = {}
  if (isValidMode(mode)) where.mode = mode
  if (players === '1' || players === '2') where.players = parseInt(players, 10)

  try {
    const scores = await db.score.findMany({
      where,
      orderBy: { score: 'desc' },
      take: limit,
      select: {
        id: true,
        playerName: true,
        score: true,
        mode: true,
        players: true,
        createdAt: true,
      },
    })
    return NextResponse.json(scores)
  } catch (err) {
    // Banco indisponível (ex: DATABASE_URL não configurada) — retorna vazio
    console.error('[GET /api/scores] DB error:', err)
    return NextResponse.json([])
  }
}

// POST /api/scores  { playerName, score, mode, players }
// Cria um novo score. Em caso de erro de banco, retorna 503 (não quebra o jogo).
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { playerName, score, mode, players } = body as {
    playerName?: unknown
    score?: unknown
    mode?: unknown
    players?: unknown
  }

  if (
    typeof playerName !== 'string' ||
    playerName.trim().length === 0 ||
    playerName.trim().length > 12
  ) {
    return NextResponse.json({ error: 'Nome inválido (1-12 caracteres)' }, { status: 400 })
  }
  if (typeof score !== 'number' || score < 0 || !Number.isFinite(score)) {
    return NextResponse.json({ error: 'Pontuação inválida' }, { status: 400 })
  }
  if (!isValidMode(mode)) {
    return NextResponse.json({ error: 'Modo inválido' }, { status: 400 })
  }
  if (players !== 1 && players !== 2) {
    return NextResponse.json({ error: 'Número de jogadores inválido' }, { status: 400 })
  }

  try {
    const created = await db.score.create({
      data: {
        playerName: playerName.trim(),
        score: Math.floor(score),
        mode,
        players,
      },
      select: {
        id: true,
        playerName: true,
        score: true,
        mode: true,
        players: true,
        createdAt: true,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    console.error('[POST /api/scores] DB error:', err)
    return NextResponse.json(
      { error: 'Banco indisponível. Tente novamente.' },
      { status: 503 },
    )
  }
}
