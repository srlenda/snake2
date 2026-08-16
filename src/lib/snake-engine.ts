// Snake engine — lógica pura do jogo (sem React).
// 5 modos: classic, classic_wrap (atravessa paredes), special, time, maze.
// 8 power-ups: ghost, slow, magnet, double, shield, speed, shrink, freeze.
// 1 ou 2 jogadores locais.
// Multiplayer: colisão entre cobras = perde pontos (não morre); mínimo 0.

/* ------------------------------------------------------------------ */
/*  Tipos                                                              */
/* ------------------------------------------------------------------ */

export type Point = { x: number; y: number }
export type Direction = 'up' | 'down' | 'left' | 'right'
export type GamePhase = 'idle' | 'playing' | 'paused' | 'gameover'
export type Mode = 'classic' | 'classic_wrap' | 'special' | 'time' | 'maze'
export type PowerUpType =
  | 'ghost' | 'slow' | 'magnet' | 'double'
  | 'shield' | 'speed' | 'shrink' | 'freeze'

export type PowerUp = {
  id: string
  x: number
  y: number
  type: PowerUpType
  bornAt: number // ms timestamp
  ttl: number // ms lifetime
}

export type Effects = {
  ghost: number // expiry timestamp (ms); 0 = inativo
  slow: number
  magnet: number
  double: number
  speed: number
  freeze: number
}

export type Player = {
  id: 0 | 1
  name: string
  snake: Point[]
  direction: Direction
  nextDirection: Direction
  score: number
  alive: boolean
  acc: number // acumulador de tempo (s)
  effects: Effects
  shieldActive: boolean // escudo: protege contra 1 colisão (one-time)
  // flags de evento no tick atual (para áudio/HUD)
  ateFood: boolean
  atePowerUp: PowerUpType | null
  died: boolean
  shieldUsed: boolean // sinaliza que o escudo foi consumido neste tick
  hitPlayer: boolean // sinaliza colisão com outra cobra (perde pontos) neste tick
}

export type GameConfig = {
  mode: Mode
  players: 1 | 2
  names: [string, string?]
}

export type EngineState = {
  config: GameConfig
  phase: GamePhase
  players: Player[]
  food: Point
  powerUps: PowerUp[]
  powerUpTimer: number // contador até próximo spawn (s)
  foodBlink: number // s
  highScore: number
  startedAt: number
  obstacles: Point[] // células bloqueadas (modo maze)
  obstacleSet: Set<string> // espelho rápido para lookup
  timeRemaining: number // s restantes (modo time)
  totalTime: number // s totais (modo time)
}

/* ------------------------------------------------------------------ */
/*  Constantes                                                         */
/* ------------------------------------------------------------------ */

export const GRID_COLS = 24
export const GRID_ROWS = 18
export const CELL = 16

export const INITIAL_SPEED = 0.165 // s por tick
export const MIN_SPEED = 0.07
export const SPEED_STEP = 0.004

export const POWERUP_SPAWN_INTERVAL = 9 // s
export const POWERUP_MAX_ACTIVE = 2
export const POWERUP_TTL = 10 // s
export const POWERUP_BLINK = 3 // pisca nos últimos 3s

export const DUR = {
  ghost: 6, // s
  slow: 6,
  magnet: 7,
  double: 7,
  speed: 5,
  freeze: 3,
} as const

export const SLOW_FACTOR = 1.7 // multiplicador de tempo (deixa mais lento)
export const SPEED_FACTOR = 0.6 // multiplicador de tempo (deixa mais rápido)
export const MAGNET_RADIUS = 3 // distância Manhattan
export const DOUBLE_MULT = 2
export const SHRINK_AMOUNT = 3 // segmentos removidos pelo shrink
export const TIME_ATTACK_DURATION = 60 // s
export const MULTIPLAYER_PENALTY = 3 // pontos perdidos ao bater em outra cobra (2P)

export const DIRS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}
const OPP: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

// Paleta LCD retrô
export const LCD = {
  bg: '#aebb6e',
  dark: '#1b2a12',
  mid: '#5d6e36',
  faint: '#88975a',
  wall: '#3d4a26', // tom intermediário para paredes do labirinto
}
// Cor de cada jogador (corpo)
export const PLAYER_COLORS = ['#1b2a12', '#3a1b1b'] // P1 verde-escuro, P2 marrom-escuro
// Cor de cada power-up (destaque)
export const POWERUP_COLORS: Record<PowerUpType, string> = {
  ghost: '#e8f0d8', // branco LCD
  slow: '#c9a23a', // âmbar
  magnet: '#b5455a', // rosado
  double: '#d9762e', // laranja
  shield: '#4a9eb8', // azul-ciano
  speed: '#c0392b', // vermelho-vivo
  shrink: '#7d3c98', // púrpura
  freeze: '#5dade2', // azul-claro
}
export const POWERUP_LABEL: Record<PowerUpType, string> = {
  ghost: 'Fantasma',
  slow: 'Lento',
  magnet: 'Ímã',
  double: '2× Pontos',
  shield: 'Escudo',
  speed: 'Rápido',
  shrink: 'Encolher',
  freeze: 'Congelar',
}
export const POWERUP_DESC: Record<PowerUpType, string> = {
  ghost: 'Atravessa paredes',
  slow: 'Deixa lento',
  magnet: 'Pega comida de longe',
  double: 'Pontos em dobro',
  shield: 'Sobrevive a 1 batida',
  speed: 'Acelera (cuidado!)',
  shrink: 'Encolhe 3 segmentos',
  freeze: 'Congela o oponente',
}

// Quais modos usam power-ups, obstáculos, timer, atravessar paredes
export function modeUsesPowerUps(mode: Mode): boolean {
  return mode === 'special' || mode === 'maze'
}
export function modeHasObstacles(mode: Mode): boolean {
  return mode === 'maze'
}
export function modeHasTimer(mode: Mode): boolean {
  return mode === 'time'
}
export function modeWrapsWalls(mode: Mode): boolean {
  return mode === 'classic_wrap'
}
export const MODE_LABEL: Record<Mode, string> = {
  classic: 'Clássico',
  classic_wrap: 'Clássico Infinito',
  special: 'Especial',
  time: 'Contra o Tempo',
  maze: 'Labirinto',
}
export const MODE_DESC: Record<Mode, string> = {
  classic: 'A experiência original. Coma, cresça, não bata.',
  classic_wrap: 'Atravessa as paredes! Em 2P, colisão entre cobras só perde pontos.',
  special: 'Power-ups aparecem: 8 habilidades diferentes.',
  time: '60 segundos para a maior pontuação. Sem power-ups.',
  maze: 'Paredes internas + power-ups. Navegue o labirinto.',
}

const STARTS: Array<{ snake: Point[]; dir: Direction }> = [
  {
    // P1: canto esquerdo, linha de cima, indo para a direita
    snake: [
      { x: 6, y: 6 },
      { x: 5, y: 6 },
      { x: 4, y: 6 },
      { x: 3, y: 6 },
    ],
    dir: 'right',
  },
  {
    // P2: canto direito, linha de baixo, indo para a esquerda
    snake: [
      { x: 17, y: 11 },
      { x: 18, y: 11 },
      { x: 19, y: 11 },
      { x: 20, y: 11 },
    ],
    dir: 'left',
  },
]

/* ------------------------------------------------------------------ */
/*  Geração de obstáculos (modo labirinto) — procedural e seguro       */
/* ------------------------------------------------------------------ */

// Densidade de paredes do labirinto (fração das células internas que viram parede).
// Sorteada a cada partida para dar variedade de dificuldade.
const MAZE_DENSITY_MIN = 0.10
const MAZE_DENSITY_MAX = 0.18
// Margem (em células) ao redor da posição inicial de cada cobra que fica livre.
const MAZE_SPAWN_MARGIN = 2
// Tamanho máximo de um segmento de parede contínuo (evita paredões longas).
const MAZE_MAX_SEGMENT = 4

function generateObstacles(): Point[] {
  // Sorteia a densidade desta partida (variedade de dificuldade).
  const density = MAZE_DENSITY_MIN + Math.random() * (MAZE_DENSITY_MAX - MAZE_DENSITY_MIN)

  // 1) Zonas de spawn seguras (área ao redor de cada cobra inicial).
  const safe = new Set<string>()
  for (const start of STARTS) {
    const h = start.snake[0]
    for (let dy = -MAZE_SPAWN_MARGIN; dy <= MAZE_SPAWN_MARGIN; dy++) {
      for (let dx = -MAZE_SPAWN_MARGIN; dx <= MAZE_SPAWN_MARGIN; dx++) {
        safe.add(`${h.x + dx},${h.y + dy}`)
      }
    }
  }

  // 2) Gera paredes candidatas em pequenos segmentos retos (1..MAZE_MAX_SEGMENT).
  //    Começa com paredes horizontais e verticais intercaladas para um visual orgânico.
  const candidates: Point[] = []
  const tries = 60
  for (let t = 0; t < tries; t++) {
    const horizontal = Math.random() < 0.5
    const len = 1 + Math.floor(Math.random() * MAZE_MAX_SEGMENT)
    const startX = 1 + Math.floor(Math.random() * (GRID_COLS - 2 - len))
    const startY = 1 + Math.floor(Math.random() * (GRID_ROWS - 2))
    for (let i = 0; i < len; i++) {
      const p: Point = horizontal
        ? { x: startX + i, y: startY }
        : { x: startX, y: startY + i }
      // Não colocar na borda nem na zona de spawn
      if (p.x <= 0 || p.x >= GRID_COLS - 1 || p.y <= 0 || p.y >= GRID_ROWS - 1) continue
      if (safe.has(`${p.x},${p.y}`)) continue
      candidates.push(p)
    }
  }

  // 3) Remove duplicatas e aplica a densidade alvo.
  const seen = new Set<string>()
  const unique: Point[] = []
  for (const p of candidates) {
    const k = `${p.x},${p.y}`
    if (!seen.has(k)) {
      seen.add(k)
      unique.push(p)
    }
  }
  // Embaralha (Fisher-Yates) e fica com a quantidade proporcional à densidade.
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[unique[i], unique[j]] = [unique[j], unique[i]]
  }
  const targetCount = Math.floor(density * GRID_COLS * GRID_ROWS)
  let obstacles = unique.slice(0, targetCount)

  // 4) Garante conectividade: toda célula livre deve ser alcançável a partir de (1,1).
  //    Remove paredes que criam ilhas, uma a uma, até o labirinto ser totalmente navegável.
  obstacles = ensureConnectivity(obstacles)

  return obstacles
}

// BFS: verifica se todas as células livres estão conectadas.
function mazeIsConnected(obstacles: Point[]): boolean {
  const wallSet = new Set(obstacles.map((o) => `${o.x},${o.y}`))
  const totalFree = GRID_COLS * GRID_ROWS - obstacles.length
  if (totalFree <= 0) return true
  // acha uma célula livre inicial
  let start: Point | null = null
  outer: for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      if (!wallSet.has(`${x},${y}`)) {
        start = { x, y }
        break outer
      }
    }
  }
  if (!start) return true
  const visited = new Set<string>([`${start.x},${start.y}`])
  const queue: Point[] = [start]
  let count = 1
  while (queue.length > 0) {
    const cur = queue.shift()!
    for (const d of [DIRS.up, DIRS.down, DIRS.left, DIRS.right]) {
      const nx = cur.x + d.x
      const ny = cur.y + d.y
      const k = `${nx},${ny}`
      if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) continue
      if (wallSet.has(k) || visited.has(k)) continue
      visited.add(k)
      count++
      queue.push({ x: nx, y: ny })
    }
  }
  return count === totalFree
}

// Remove paredes (da última para a primeira) até o labirinto ficar conectado.
function ensureConnectivity(obstacles: Point[]): Point[] {
  const result = [...obstacles]
  let guard = 0
  while (!mazeIsConnected(result) && result.length > 0 && guard < 1000) {
    result.pop()
    guard++
  }
  return result
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function createPlayer(id: 0 | 1, name: string): Player {
  const s = STARTS[id]
  return {
    id,
    name: name || (id === 0 ? 'P1' : 'P2'),
    snake: s.snake.map((p) => ({ ...p })),
    direction: s.dir,
    nextDirection: s.dir,
    score: 0,
    alive: true,
    acc: 0,
    effects: { ghost: 0, slow: 0, magnet: 0, double: 0, speed: 0, freeze: 0 },
    shieldActive: false,
    ateFood: false,
    atePowerUp: null,
    died: false,
    shieldUsed: false,
    hitPlayer: false,
  }
}

export function createEngine(config: GameConfig, highScore: number): EngineState {
  const players: Player[] = [createPlayer(0, config.names[0])]
  if (config.players === 2) players.push(createPlayer(1, config.names[1] ?? 'P2'))
  const obstacles = modeHasObstacles(config.mode) ? generateObstacles() : []
  const obstacleSet = new Set(obstacles.map((o) => `${o.x},${o.y}`))
  const food = spawnFood(players, obstacleSet) ?? { x: 12, y: 9 }
  return {
    config,
    phase: 'idle',
    players,
    food,
    powerUps: [],
    powerUpTimer: 0,
    foodBlink: 0,
    highScore,
    startedAt: 0,
    obstacles,
    obstacleSet,
    timeRemaining: modeHasTimer(config.mode) ? TIME_ATTACK_DURATION : 0,
    totalTime: TIME_ATTACK_DURATION,
  }
}

export function resetEngine(state: EngineState) {
  state.players = state.players.map((p, i) => createPlayer(i as 0 | 1, p.name))
  state.obstacles = modeHasObstacles(state.config.mode) ? generateObstacles() : []
  state.obstacleSet = new Set(state.obstacles.map((o) => `${o.x},${o.y}`))
  state.food = spawnFood(state.players, state.obstacleSet) ?? { x: 12, y: 9 }
  state.powerUps = []
  state.powerUpTimer = 0
  state.phase = 'idle'
  state.timeRemaining = modeHasTimer(state.config.mode) ? TIME_ATTACK_DURATION : 0
}

export function startEngine(state: EngineState) {
  resetEngine(state)
  state.phase = 'playing'
  state.startedAt = performance.now()
}

export function togglePause(state: EngineState) {
  if (state.phase === 'playing') state.phase = 'paused'
  else if (state.phase === 'paused') state.phase = 'playing'
}

export function changeDirection(state: EngineState, playerId: 0 | 1, dir: Direction) {
  if (state.phase !== 'playing') return
  const p = state.players[playerId]
  if (!p || !p.alive) return
  if (dir === OPP[p.direction]) return
  if (dir === OPP[p.nextDirection]) return
  p.nextDirection = dir
}

export function isEffectActive(p: Player, type: PowerUpType, now: number) {
  return p.effects[type] > now
}

export function playerSpeed(p: Player, now: number) {
  const base = Math.max(MIN_SPEED, INITIAL_SPEED - p.score * SPEED_STEP)
  if (isEffectActive(p, 'slow', now)) return base * SLOW_FACTOR
  if (isEffectActive(p, 'speed', now)) return base * SPEED_FACTOR
  return base
}

/* ------------------------------------------------------------------ */
/*  Spawn de comida e power-ups                                        */
/* ------------------------------------------------------------------ */

export function spawnFood(players: Player[], obstacleSet: Set<string>): Point | null {
  const occupied = new Set(obstacleSet)
  for (const p of players) for (const s of p.snake) occupied.add(`${s.x},${s.y}`)
  const free: Point[] = []
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y })
    }
  }
  if (free.length === 0) return null
  return free[Math.floor(Math.random() * free.length)]
}

export function spawnPowerUp(state: EngineState, now: number): PowerUp | null {
  if (state.powerUps.length >= POWERUP_MAX_ACTIVE) return null
  const occupied = new Set(state.obstacleSet)
  occupied.add(`${state.food.x},${state.food.y}`)
  for (const p of state.players) for (const s of p.snake) occupied.add(`${s.x},${s.y}`)
  for (const pu of state.powerUps) occupied.add(`${pu.x},${pu.y}`)
  const free: Point[] = []
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y })
    }
  }
  if (free.length === 0) return null
  const pos = free[Math.floor(Math.random() * free.length)]
  // Em 1P não há oponente para congelar
  const allTypes: PowerUpType[] = ['ghost', 'slow', 'magnet', 'double', 'shield', 'speed', 'shrink']
  const types = state.config.players === 2 ? [...allTypes, 'freeze'] : allTypes
  const type = types[Math.floor(Math.random() * types.length)]
  return {
    id: `pu_${now}_${Math.floor(Math.random() * 1000)}`,
    x: pos.x,
    y: pos.y,
    type,
    bornAt: now,
    ttl: POWERUP_TTL * 1000,
  }
}

/* ------------------------------------------------------------------ */
/*  Tick — avança um jogador em um passo                               */
/* ------------------------------------------------------------------ */

export function tickPlayer(
  state: EngineState,
  playerId: 0 | 1,
  now: number,
) {
  const p = state.players[playerId]
  if (!p || !p.alive) return
  // limpa flags de evento
  p.ateFood = false
  p.atePowerUp = null
  p.died = false
  p.shieldUsed = false
  p.hitPlayer = false

  // Congelado: não se move neste tick
  if (isEffectActive(p, 'freeze', now)) return

  p.direction = p.nextDirection
  const head = p.snake[0]
  const d = DIRS[p.direction]
  let newHead: Point = { x: head.x + d.x, y: head.y + d.y }

  const ghost = isEffectActive(p, 'ghost', now)
  const wraps = modeWrapsWalls(state.config.mode)
  const passWalls = ghost || wraps

  // Função auxiliar: mata o jogador (a menos que tenha escudo)
  const tryKill = (): boolean => {
    if (p.shieldActive) {
      // consome o escudo: a cobra sobrevive e fica parada neste tick
      p.shieldActive = false
      p.shieldUsed = true
      return true // shield salvou
    }
    p.alive = false
    p.died = true
    p.snake = []
    return false
  }

  // Colisão com parede / borda
  let wallHit = false
  if (newHead.x < 0 || newHead.x >= GRID_COLS || newHead.y < 0 || newHead.y >= GRID_ROWS) {
    if (passWalls) {
      newHead = {
        x: (newHead.x + GRID_COLS) % GRID_COLS,
        y: (newHead.y + GRID_ROWS) % GRID_ROWS,
      }
    } else {
      wallHit = true
    }
  }
  if (wallHit) {
    if (tryKill()) return // escudo salvou: fica parado
    return
  }

  // Colisão com obstáculo (labirinto) — só fantasma passa
  if (!ghost && state.obstacleSet.has(`${newHead.x},${newHead.y}`)) {
    if (tryKill()) return
    return
  }

  // Ímã: se a comida estiver perto, conta como comida
  const magnet = isEffectActive(p, 'magnet', now)
  const dist = Math.abs(newHead.x - state.food.x) + Math.abs(newHead.y - state.food.y)
  const willEat = magnet ? dist <= MAGNET_RADIUS : newHead.x === state.food.x && newHead.y === state.food.y

  // Colisão com o próprio corpo (ignora cauda se não vai comer)
  const body = willEat ? p.snake : p.snake.slice(0, -1)
  if (body.some((s) => s.x === newHead.x && s.y === newHead.y)) {
    if (tryKill()) return
    return
  }

  // Colisão com outros jogadores: perde pontos (não morre), escudo protege
  for (const other of state.players) {
    if (other.id === p.id || !other.alive) continue
    const hitHead = other.snake[0] && other.snake[0].x === newHead.x && other.snake[0].y === newHead.y
    const hitBody = other.snake.some((s) => s.x === newHead.x && s.y === newHead.y)
    if (hitHead || hitBody) {
      // Colisão entre cobras: perde pontos (mínimo 0) ou consome escudo
      if (p.shieldActive) {
        p.shieldActive = false
        p.shieldUsed = true
      } else {
        p.score = Math.max(0, p.score - MULTIPLAYER_PENALTY)
        p.hitPlayer = true
      }
      // Não se move para a célula ocupada; fica parado neste tick
      return
    }
  }

  // Move
  p.snake.unshift(newHead)

  // Comida
  if (willEat) {
    const mult = isEffectActive(p, 'double', now) ? DOUBLE_MULT : 1
    p.score += 1 * mult
    p.ateFood = true
    const nf = spawnFood(state.players, state.obstacleSet)
    if (nf) state.food = nf
  } else {
    p.snake.pop()
  }

  // Power-up (modos special e maze)
  if (modeUsesPowerUps(state.config.mode)) {
    const idx = state.powerUps.findIndex((pu) => pu.x === newHead.x && pu.y === newHead.y)
    if (idx >= 0) {
      const pu = state.powerUps[idx]
      activatePowerUp(state, p, pu.type, now)
      p.atePowerUp = pu.type
      state.powerUps.splice(idx, 1)
    }
  }
}

function activatePowerUp(state: EngineState, p: Player, type: PowerUpType, now: number) {
  switch (type) {
    case 'shrink':
      // instantâneo: remove 3 segmentos da cauda (mínimo 3)
      if (p.snake.length > 3) {
        const remove = Math.min(SHRINK_AMOUNT, p.snake.length - 3)
        p.snake.splice(p.snake.length - remove, remove)
      }
      break
    case 'shield':
      // flag one-time
      p.shieldActive = true
      break
    case 'freeze':
      // afeta o oponente
      for (const other of state.players) {
        if (other.id !== p.id && other.alive) {
          other.effects.freeze = now + DUR.freeze * 1000
        }
      }
      break
    default:
      // efeitos com duração (timestamp)
      p.effects[type] = now + DUR[type as keyof typeof DUR] * 1000
  }
}

/* ------------------------------------------------------------------ */
/*  Atualização por frame (delta em segundos, now em ms)               */
/* ------------------------------------------------------------------ */

export function updateEngine(state: EngineState, dt: number, now: number) {
  state.foodBlink += dt
  if (state.phase !== 'playing') return

  // Timer (modo contra o tempo)
  if (modeHasTimer(state.config.mode)) {
    state.timeRemaining -= dt
    if (state.timeRemaining <= 0) {
      state.timeRemaining = 0
      state.phase = 'gameover'
      return
    }
  }

  // Spawn de power-ups (modos special e maze)
  if (modeUsesPowerUps(state.config.mode)) {
    state.powerUpTimer += dt
    if (state.powerUpTimer >= POWERUP_SPAWN_INTERVAL) {
      state.powerUpTimer = 0
      const pu = spawnPowerUp(state, now)
      if (pu) state.powerUps.push(pu)
    }
    // Remove power-ups expirados
    state.powerUps = state.powerUps.filter((pu) => now - pu.bornAt < pu.ttl)
  }

  // Tick de cada jogador com sua própria velocidade
  for (const p of state.players) {
    if (!p.alive) continue
    const sp = playerSpeed(p, now)
    p.acc += dt
    let guard = 0
    while (p.acc >= sp && p.alive && guard < 5) {
      p.acc -= sp
      tickPlayer(state, p.id, now)
      guard++
    }
  }

  // Game over quando todos mortos
  if (state.players.every((p) => !p.alive)) {
    state.phase = 'gameover'
  }
}

/* ------------------------------------------------------------------ */
/*  Resultado / ranking local                                          */
/* ------------------------------------------------------------------ */

export function getWinner(state: EngineState): Player | null {
  if (state.players.length === 1) return state.players[0]
  const [a, b] = state.players
  if (a.score > b.score) return a
  if (b.score > a.score) return b
  return null // empate
}

export function maxScore(state: EngineState): number {
  return state.players.reduce((m, p) => Math.max(m, p.score), 0)
}
