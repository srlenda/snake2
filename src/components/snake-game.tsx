'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Play, Pause, RotateCcw, Volume2, VolumeX, Gamepad2,
  Trophy, Users, User, Ghost, Snail, Magnet, Star, ArrowLeft, Crown,
  Shield, Zap, Minimize, Snowflake, Clock, Grid3x3,
} from 'lucide-react'
import {
  createEngine, startEngine, togglePause, changeDirection, updateEngine,
  maxScore, getWinner, isEffectActive, modeUsesPowerUps, modeHasTimer,
  GRID_COLS, GRID_ROWS, CELL, LCD, PLAYER_COLORS, POWERUP_COLORS,
  POWERUP_LABEL, POWERUP_DESC, POWERUP_BLINK, MODE_LABEL, MODE_DESC,
  type EngineState, type Mode, type PowerUpType, type Effects,
} from '@/lib/snake-engine'

/* ------------------------------------------------------------------ */
/*  Tipos locais                                                       */
/* ------------------------------------------------------------------ */

type View = 'menu' | 'game'
type ScoreEntry = {
  id: string; playerName: string; score: number
  mode: string; players: number; createdAt: string
}

const GP = { A: 0, B: 1, START: 9, DPAD_UP: 12, DPAD_DOWN: 13, DPAD_LEFT: 14, DPAD_RIGHT: 15 }
const STICK_DEADZONE = 0.5

/* ------------------------------------------------------------------ */
/*  Som (Web Audio)                                                    */
/* ------------------------------------------------------------------ */

function useSound(muted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)
  const beep = useCallback(
    (freq: number, dur: number, type: OscillatorType = 'square', vol = 0.12) => {
      if (muted) return
      try {
        if (!ctxRef.current) {
          const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          ctxRef.current = new AC()
        }
        const ctx = ctxRef.current
        if (ctx.state === 'suspended') void ctx.resume()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = type
        osc.frequency.setValueAtTime(freq, ctx.currentTime)
        gain.gain.setValueAtTime(vol, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur)
        osc.connect(gain).connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + dur)
      } catch {
        /* ignore */
      }
    },
    [muted],
  )
  return beep
}

/* ------------------------------------------------------------------ */
/*  Componente                                                         */
/* ------------------------------------------------------------------ */

export function SnakeGame() {
  // ---- View / menu state ----
  const [view, setView] = useState<View>('menu')
  const [menuMode, setMenuMode] = useState<Mode>('classic')
  const [menuPlayers, setMenuPlayers] = useState<1 | 2>(1)
  const [p1Name, setP1Name] = useState('Jogador')
  const [p2Name, setP2Name] = useState('Jogador 2')

  // ---- Game state (espelhado da engine p/ HUD) ----
  const [phase, setPhase] = useState<'idle' | 'playing' | 'paused' | 'gameover'>('idle')
  const [p1Score, setP1Score] = useState(0)
  const [p2Score, setP2Score] = useState(0)
  const [p1Effects, setP1Effects] = useState<Effects | null>(null)
  const [p2Effects, setP2Effects] = useState<Effects | null>(null)
  const [p1Shield, setP1Shield] = useState(false)
  const [p2Shield, setP2Shield] = useState(false)
  const [highScore, setHighScore] = useState(0)
  const [gameOverInfo, setGameOverInfo] = useState<{ submitted: boolean; loading: boolean; saved: boolean }>({
    submitted: false, loading: false, saved: false,
  })
  const [config, setConfig] = useState<{ mode: Mode; players: 1 | 2; names: [string, string?] }>({
    mode: 'classic', players: 1, names: ['Jogador'],
  })
  const [winner, setWinner] = useState<{ name: string; score: number; tie: boolean } | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(0)

  // ---- Misc ----
  const [muted, setMuted] = useState(false)
  const [gamepadConnected, setGamepadConnected] = useState(false)
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([])
  const [finalBoard, setFinalBoard] = useState<ScoreEntry[]>([])

  // ---- Refs ----
  const engineRef = useRef<EngineState | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const configRef = useRef<{ mode: Mode; players: 1 | 2; names: [string, string?] }>({
    mode: 'classic', players: 1, names: ['Jogador'],
  })
  const prevPhaseRef = useRef<string>('idle')
  const submittedRef = useRef(false)
  const gamepadBtnRef = useRef({ a: false, b: false, s: false })

  const beep = useSound(muted)
  const beepRef = useRef(beep)
  useEffect(() => { beepRef.current = beep }, [beep])

  /* ---------------------------------------------------------------- */
  /*  High score local                                                */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('snake-hi') : null
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setHighScore(parseInt(stored, 10) || 0)
  }, [])

  /* ---------------------------------------------------------------- */
  /*  Leaderboard no menu                                             */
  /* ---------------------------------------------------------------- */
  const fetchBoard = useCallback(async (mode: Mode, players: 1 | 2) => {
    try {
      const res = await fetch(`/api/scores?mode=${mode}&players=${players}&limit=5`)
      if (res.ok) setLeaderboard(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (view === 'menu') void fetchBoard(menuMode, menuPlayers)
  }, [view, menuMode, menuPlayers, fetchBoard])

  /* ---------------------------------------------------------------- */
  /*  Gamepad connection                                              */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const onConnect = () => {
      setGamepadConnected(true)
      beepRef.current(660, 0.05, 'square', 0.06)
    }
    const onDisconnect = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : []
      if (!Array.from(pads).some((p) => p && p.connected)) setGamepadConnected(false)
    }
    window.addEventListener('gamepadconnected', onConnect)
    window.addEventListener('gamepaddisconnected', onDisconnect)
    return () => {
      window.removeEventListener('gamepadconnected', onConnect)
      window.removeEventListener('gamepaddisconnected', onDisconnect)
    }
  }, [])

  /* ---------------------------------------------------------------- */
  /*  Iniciar jogo                                                    */
  /* ---------------------------------------------------------------- */
  const startNewGame = useCallback(() => {
    const config = {
      mode: menuMode,
      players: menuPlayers,
      names: [p1Name.trim() || 'Jogador', p2Name.trim() || 'Jogador 2'],
    } as { mode: Mode; players: 1 | 2; names: [string, string?] }
    configRef.current = config
    setConfig(config)
    const engine = createEngine(config, highScore)
    startEngine(engine)
    engineRef.current = engine
    submittedRef.current = false
    prevPhaseRef.current = 'playing'
    setGameOverInfo({ submitted: false, loading: false, saved: false })
    setFinalBoard([])
    setWinner(null)
    setPhase('playing')
    setP1Score(0); setP2Score(0)
    setP1Effects(null); setP2Effects(null)
    setP1Shield(false); setP2Shield(false)
    setView('game')
  }, [menuMode, menuPlayers, p1Name, p2Name, highScore])

  const playAgain = useCallback(() => {
    const e = engineRef.current
    if (!e) return
    startEngine(e)
    submittedRef.current = false
    prevPhaseRef.current = 'playing'
    setGameOverInfo({ submitted: false, loading: false, saved: false })
    setFinalBoard([])
    setWinner(null)
    setPhase('playing')
  }, [])

  const goToMenu = useCallback(() => {
    setView('menu')
    setPhase('idle')
  }, [])

  /* ---------------------------------------------------------------- */
  /*  Submit scores online                                            */
  /* ---------------------------------------------------------------- */
  const submitScores = useCallback(async (e: EngineState) => {
    setGameOverInfo({ submitted: false, loading: true })
    const cfg = configRef.current
    let saved = false
    try {
      const responses = await Promise.all(
        e.players
          .filter((p) => p.score > 0)
          .map((p) =>
            fetch('/api/scores', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ playerName: p.name, score: p.score, mode: cfg.mode, players: cfg.players }),
            }),
          ),
      )
      // Se todos os POSTs foram 201, considera salvo
      saved = responses.length > 0 && responses.every((r) => r.ok)
      if (e.players.every((p) => p.score === 0)) saved = true // sem scores para salvar = ok
      const res = await fetch(`/api/scores?mode=${cfg.mode}&players=${cfg.players}&limit=5`)
      if (res.ok) setFinalBoard(await res.json())
    } catch {
      /* ignore — rede indisponível */
      saved = false
    }
    setGameOverInfo({ submitted: true, loading: false, saved })
  }, [])

  /* ---------------------------------------------------------------- */
  /*  Sync HUD (lê engine -> state)                                   */
  /* ---------------------------------------------------------------- */
  const syncHud = useCallback(() => {
    const e = engineRef.current
    if (!e) return
    setPhase(e.phase)
    setP1Score(e.players[0]?.score ?? 0)
    setP2Score(e.players[1]?.score ?? 0)
    setP1Effects(e.players[0] ? { ...e.players[0].effects } : null)
    setP2Effects(e.players[1] ? { ...e.players[1].effects } : null)
    setP1Shield(!!e.players[0]?.shieldActive)
    setP2Shield(!!e.players[1]?.shieldActive)
    setTimeRemaining(Math.ceil(e.timeRemaining))

    if (e.phase === 'gameover' && prevPhaseRef.current !== 'gameover' && !submittedRef.current) {
      submittedRef.current = true
      beepRef.current(330, 0.12, 'square', 0.14)
      window.setTimeout(() => beepRef.current(220, 0.12, 'square', 0.14), 120)
      window.setTimeout(() => beepRef.current(140, 0.28, 'square', 0.14), 240)
      const best = maxScore(e)
      setHighScore((prev) => {
        const next = Math.max(prev, best)
        if (next !== prev && typeof window !== 'undefined') {
          window.localStorage.setItem('snake-hi', String(next))
        }
        return next
      })
      const w = getWinner(e)
      setWinner(w ? { name: w.name, score: w.score, tie: false } : { name: '', score: maxScore(e), tie: true })
      void submitScores(e)
    }
    prevPhaseRef.current = e.phase
  }, [submitScores])

  /* ---------------------------------------------------------------- */
  /*  Gamepad polling (P1)                                            */
  /* ---------------------------------------------------------------- */
  const pollGamepad = useCallback((e: EngineState) => {
    if (!navigator.getGamepads) return
    const pad = Array.from(navigator.getGamepads()).find((p) => p && p.connected)
    if (!pad) return
    const pressed = (i: number) => !!pad.buttons[i] && pad.buttons[i].pressed
    if (pressed(GP.DPAD_UP)) changeDirection(e, 0, 'up')
    if (pressed(GP.DPAD_DOWN)) changeDirection(e, 0, 'down')
    if (pressed(GP.DPAD_LEFT)) changeDirection(e, 0, 'left')
    if (pressed(GP.DPAD_RIGHT)) changeDirection(e, 0, 'right')
    const ax = pad.axes[0] ?? 0
    const ay = pad.axes[1] ?? 0
    if (Math.abs(ax) > Math.abs(ay)) {
      if (ax > STICK_DEADZONE) changeDirection(e, 0, 'right')
      else if (ax < -STICK_DEADZONE) changeDirection(e, 0, 'left')
    } else {
      if (ay > STICK_DEADZONE) changeDirection(e, 0, 'down')
      else if (ay < -STICK_DEADZONE) changeDirection(e, 0, 'up')
    }
    const g = gamepadBtnRef.current
    const a = pressed(GP.A), b = pressed(GP.B), s = pressed(GP.START)
    if (a && !g.a) { if (e.phase === 'playing' || e.phase === 'paused') togglePause(e) }
    if (b && !g.b) { startEngine(e); prevPhaseRef.current = 'playing'; setPhase('playing') }
    if (s && !g.s) togglePause(e)
    g.a = a; g.b = b; g.s = s
  }, [])

  /* ---------------------------------------------------------------- */
  /*  Render canvas                                                   */
  /* ---------------------------------------------------------------- */
  const draw = useCallback((e: EngineState, now: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = LCD.bg
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = LCD.faint
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        ctx.fillRect(x * CELL + CELL / 2 - 0.5, y * CELL + CELL / 2 - 0.5, 1, 1)
      }
    }

    ctx.fillStyle = LCD.dark
    ctx.fillRect(0, 0, GRID_COLS * CELL, 2)
    ctx.fillRect(0, GRID_ROWS * CELL - 2, GRID_COLS * CELL, 2)
    ctx.fillRect(0, 0, 2, GRID_ROWS * CELL)
    ctx.fillRect(GRID_COLS * CELL - 2, 0, 2, GRID_ROWS * CELL)

    // Obstáculos (modo labirinto)
    ctx.fillStyle = LCD.wall
    for (const o of e.obstacles) {
      ctx.fillRect(o.x * CELL + 1, o.y * CELL + 1, CELL - 2, CELL - 2)
    }

    const blinkOn = Math.floor(e.foodBlink / 0.3) % 2 === 0
    if (blinkOn) {
      const fx = e.food.x * CELL, fy = e.food.y * CELL
      ctx.fillStyle = LCD.dark
      ctx.fillRect(fx + CELL / 2 - 2, fy + 2, 4, CELL - 4)
      ctx.fillRect(fx + 2, fy + CELL / 2 - 2, CELL - 4, 4)
    }

    // Power-ups (modos special e maze)
    if (modeUsesPowerUps(e.config.mode)) {
      for (const pu of e.powerUps) {
        const age = now - pu.bornAt
        const remaining = pu.ttl - age
        const blink = remaining < POWERUP_BLINK * 1000
        if (blink && Math.floor(age / 150) % 2 === 0) continue
        const px = pu.x * CELL, py = pu.y * CELL
        ctx.fillStyle = POWERUP_COLORS[pu.type]
        ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2)
        ctx.fillStyle = LCD.dark
        drawGlyph(ctx, pu.type, px, py)
      }
    }

    for (const p of e.players) {
      if (!p.alive || p.snake.length === 0) continue
      const color = PLAYER_COLORS[p.id]
      const ghost = isEffectActive(p, 'ghost', now)
      const magnet = isEffectActive(p, 'magnet', now)
      const doubled = isEffectActive(p, 'double', now)
      const speed = isEffectActive(p, 'speed', now)
      const shield = p.shieldActive
      const frozen = isEffectActive(p, 'freeze', now)
      // Aura de ímã na cabeça
      if (magnet) {
        const h = p.snake[0]
        ctx.strokeStyle = POWERUP_COLORS.magnet
        ctx.lineWidth = 1
        ctx.strokeRect(h.x * CELL - 1, h.y * CELL - 1, CELL + 2, CELL + 2)
      }
      // Aura de escudo (anel azul em toda a cobra)
      if (shield) {
        ctx.strokeStyle = POWERUP_COLORS.shield
        ctx.lineWidth = 1
        for (const seg of p.snake) {
          ctx.strokeRect(seg.x * CELL + 0.5, seg.y * CELL + 0.5, CELL - 1, CELL - 1)
        }
      }
      for (let i = 0; i < p.snake.length; i++) {
        const seg = p.snake[i]
        const sx = seg.x * CELL, sy = seg.y * CELL
        if (ghost) {
          ctx.strokeStyle = color
          ctx.lineWidth = 2
          ctx.strokeRect(sx + 2, sy + 2, CELL - 4, CELL - 4)
        } else {
          ctx.fillStyle = color
          ctx.fillRect(sx + 1, sy + 1, CELL - 2, CELL - 2)
        }
        if (doubled) {
          ctx.fillStyle = POWERUP_COLORS.double
          ctx.fillRect(sx + 1, sy + 1, CELL - 2, 1)
        }
        if (speed) {
          ctx.fillStyle = POWERUP_COLORS.speed
          ctx.fillRect(sx + 1, sy + CELL - 2, CELL - 2, 1)
        }
      }
      const head = p.snake[0]
      if (head) {
        const hx = head.x * CELL, hy = head.y * CELL
        // Congelado: olhos em X (cruzado) indicando paralisia
        if (frozen) {
          ctx.fillStyle = POWERUP_COLORS.freeze
          ctx.fillRect(hx + 3, hy + 3, 2, 2)
          ctx.fillRect(hx + 9, hy + 3, 2, 2)
          ctx.fillRect(hx + 6, hy + 6, 2, 2)
          ctx.fillRect(hx + 3, hy + 9, 2, 2)
          ctx.fillRect(hx + 9, hy + 9, 2, 2)
        } else {
          ctx.fillStyle = ghost ? color : LCD.bg
          const d = p.direction
          if (d === 'right' || d === 'left') {
            ctx.fillRect(hx + (d === 'right' ? 11 : 3), hy + 4, 2, 2)
            ctx.fillRect(hx + (d === 'right' ? 11 : 3), hy + 10, 2, 2)
          } else {
            ctx.fillRect(hx + 4, hy + (d === 'down' ? 11 : 3), 2, 2)
            ctx.fillRect(hx + 10, hy + (d === 'down' ? 11 : 3), 2, 2)
          }
        }
      }
    }
  }, [])

  /* ---------------------------------------------------------------- */
  /*  Loop principal                                                  */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (view !== 'game') return
    let raf = 0
    let last = performance.now()
    let syncAcc = 0
    const loop = (now: number) => {
      const e = engineRef.current
      if (!e) { raf = requestAnimationFrame(loop); return }
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now

      pollGamepad(e)
      updateEngine(e, dt, now)

      for (const p of e.players) {
        if (p.ateFood) { beepRef.current(880, 0.06, 'square', 0.1); p.ateFood = false }
        if (p.atePowerUp) { beepRef.current(1320, 0.09, 'square', 0.12); p.atePowerUp = null }
        if (p.hitPlayer) { beepRef.current(180, 0.15, 'sawtooth', 0.14); p.hitPlayer = false }
      }

      syncAcc += dt
      if (syncAcc >= 0.2 || e.phase === 'gameover') {
        syncAcc = 0
        syncHud()
      }

      draw(e, now)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [view, syncHud, pollGamepad, draw])

  /* ---------------------------------------------------------------- */
  /*  Teclado                                                         */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (view !== 'game') return
    const onKey = (ev: KeyboardEvent) => {
      const e = engineRef.current
      if (!e) return
      const cfg = configRef.current
      switch (ev.key) {
        case 'w': case 'W': ev.preventDefault(); changeDirection(e, 0, 'up'); break
        case 's': case 'S': ev.preventDefault(); changeDirection(e, 0, 'down'); break
        case 'a': case 'A': ev.preventDefault(); changeDirection(e, 0, 'left'); break
        case 'd': case 'D': ev.preventDefault(); changeDirection(e, 0, 'right'); break
        case 'ArrowUp': ev.preventDefault(); changeDirection(e, cfg.players === 2 ? 1 : 0, 'up'); break
        case 'ArrowDown': ev.preventDefault(); changeDirection(e, cfg.players === 2 ? 1 : 0, 'down'); break
        case 'ArrowLeft': ev.preventDefault(); changeDirection(e, cfg.players === 2 ? 1 : 0, 'left'); break
        case 'ArrowRight': ev.preventDefault(); changeDirection(e, cfg.players === 2 ? 1 : 0, 'right'); break
        case ' ': case 'Enter': case 'p': case 'P':
          ev.preventDefault()
          if (e.phase === 'gameover') playAgain()
          else togglePause(e)
          break
        case 'r': case 'R': ev.preventDefault(); playAgain(); break
        case 'm': case 'M': ev.preventDefault(); setMuted((m) => !m); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, playAgain])

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-zinc-900 via-zinc-950 to-black flex flex-col">
      <div className="pointer-events-none fixed inset-0 opacity-60"
        style={{ background: 'radial-gradient(60% 50% at 50% 0%, rgba(120,160,90,0.12), transparent 70%)' }} />

      <main className="relative flex-1 flex flex-col items-center px-4 py-6 sm:py-8">
        {view === 'menu' ? (
          <MenuView
            menuMode={menuMode} setMenuMode={setMenuMode}
            menuPlayers={menuPlayers} setMenuPlayers={setMenuPlayers}
            p1Name={p1Name} setP1Name={setP1Name}
            p2Name={p2Name} setP2Name={setP2Name}
            highScore={highScore}
            leaderboard={leaderboard}
            onStart={startNewGame}
            gamepadConnected={gamepadConnected}
            muted={muted} setMuted={setMuted}
          />
        ) : (
          <GameView
            canvasRef={canvasRef}
            phase={phase}
            p1Score={p1Score} p2Score={p2Score}
            p1Effects={p1Effects} p2Effects={p2Effects}
            p1Shield={p1Shield} p2Shield={p2Shield}
            highScore={highScore}
            config={config}
            winner={winner}
            timeRemaining={timeRemaining}
            muted={muted} setMuted={setMuted}
            playAgain={playAgain} goToMenu={goToMenu}
            togglePause={() => { const e = engineRef.current; if (e) togglePause(e) }}
            finalBoard={finalBoard}
            gameOverInfo={gameOverInfo}
            onTouchDir={(pid, dir) => { const e = engineRef.current; if (e) changeDirection(e, pid, dir) }}
          />
        )}
      </main>

      <footer className="mt-auto border-t border-emerald-900/30 bg-black/40 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4 text-center text-xs text-emerald-100/40 font-mono">
          SNAKE II · modos clássico & especial · multiplayer local · leaderboard online 🐍
        </div>
      </footer>
    </div>
  )
}

/* ================================================================== */
/*  Desenho de glifos de power-up                                      */
/* ================================================================== */

function drawGlyph(ctx: CanvasRenderingContext2D, type: PowerUpType, px: number, py: number) {
  const c = CELL
  switch (type) {
    case 'ghost':
      ctx.strokeStyle = LCD.dark; ctx.lineWidth = 1
      ctx.strokeRect(px + 4, py + 4, c - 8, c - 8)
      break
    case 'slow':
      ctx.fillRect(px + 5, py + 5, c - 10, c - 10)
      break
    case 'magnet':
      ctx.fillRect(px + c / 2 - 1, py + 4, 2, c - 8)
      ctx.fillRect(px + 4, py + c / 2 - 1, c - 8, 2)
      break
    case 'double':
      ctx.fillRect(px + c / 2 - 1, py + 4, 2, 2)
      ctx.fillRect(px + c / 2 - 1, py + c - 6, 2, 2)
      break
    case 'shield':
      // escudo: anel vazado
      ctx.strokeStyle = LCD.dark; ctx.lineWidth = 1
      ctx.strokeRect(px + 3, py + 3, c - 6, c - 6)
      break
    case 'speed':
      // raio: dois triângulos
      ctx.beginPath()
      ctx.moveTo(px + c / 2, py + 3)
      ctx.lineTo(px + 4, py + c / 2)
      ctx.lineTo(px + c / 2 - 1, py + c / 2)
      ctx.lineTo(px + c - 4, py + c - 3)
      ctx.lineTo(px + c / 2 + 1, py + c / 2)
      ctx.lineTo(px + c / 2 + 2, py + c / 2)
      ctx.closePath()
      ctx.fill()
      break
    case 'shrink':
      // setas apontando para dentro
      ctx.fillRect(px + 3, py + c / 2 - 1, 3, 2)
      ctx.fillRect(px + 4, py + c / 2 - 2, 1, 4)
      ctx.fillRect(px + c - 6, py + c / 2 - 1, 3, 2)
      ctx.fillRect(px + c - 5, py + c / 2 - 2, 1, 4)
      break
    case 'freeze':
      // floco de neve (cruz + diagonais)
      ctx.fillRect(px + c / 2 - 1, py + 3, 2, c - 6)
      ctx.fillRect(px + 3, py + c / 2 - 1, c - 6, 2)
      break
  }
}

/* ================================================================== */
/*  Menu view                                                          */
/* ================================================================== */

function MenuView(props: {
  menuMode: Mode; setMenuMode: (m: Mode) => void
  menuPlayers: 1 | 2; setMenuPlayers: (p: 1 | 2) => void
  p1Name: string; setP1Name: (s: string) => void
  p2Name: string; setP2Name: (s: string) => void
  highScore: number
  leaderboard: ScoreEntry[]
  onStart: () => void
  gamepadConnected: boolean
  muted: boolean; setMuted: (f: boolean | ((p: boolean) => boolean)) => void
}) {
  const { menuMode, setMenuMode, menuPlayers, setMenuPlayers, p1Name, setP1Name, p2Name, setP2Name, highScore, leaderboard, onStart, gamepadConnected, muted, setMuted } = props
  return (
    <div className="w-full max-w-2xl">
      <div className="mb-6 text-center">
        <h1 className="font-mono text-3xl sm:text-4xl font-extrabold tracking-[0.25em] text-emerald-100"
          style={{ textShadow: '0 0 22px rgba(120,200,120,0.4)' }}>
          SNAKE&nbsp;II
        </h1>
        <p className="mt-1 font-mono text-[0.65rem] sm:text-xs tracking-widest text-emerald-100/40">
          MENU PRINCIPAL · ESCOLHA SEU MODO
        </p>
      </div>

      <div className="mb-5">
        <p className="mb-2 font-mono text-xs tracking-widest text-emerald-100/60 uppercase">Modo de jogo</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(['classic', 'classic_wrap', 'special', 'time', 'maze'] as Mode[]).map((m) => (
            <ModeCard
              key={m}
              active={menuMode === m}
              onClick={() => setMenuMode(m)}
              title={MODE_LABEL[m]}
              desc={MODE_DESC[m]}
              icon={m === 'classic' ? <Star className="size-3.5" />
                : m === 'classic_wrap' ? <Ghost className="size-3.5" />
                : m === 'special' ? <Zap className="size-3.5" />
                : m === 'time' ? <Clock className="size-3.5" />
                : <Grid3x3 className="size-3.5" />}
            />
          ))}
        </div>
      </div>

      <div className="mb-5">
        <p className="mb-2 font-mono text-xs tracking-widest text-emerald-100/60 uppercase">Jogadores</p>
        <div className="grid grid-cols-2 gap-3">
          <PlayerToggle active={menuPlayers === 1} onClick={() => setMenuPlayers(1)} icon={<User className="size-4" />} label="1 Jogador" sub="Setas / WASD" />
          <PlayerToggle active={menuPlayers === 2} onClick={() => setMenuPlayers(2)} icon={<Users className="size-4" />} label="2 Jogadores" sub="P1: WASD · P2: Setas" />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block font-mono text-[0.65rem] tracking-widest text-emerald-100/50 uppercase">Nome {menuPlayers === 2 ? 'Jogador 1' : ''}</label>
          <Input value={p1Name} onChange={(e) => setP1Name(e.target.value.slice(0, 12))} maxLength={12}
            placeholder="Seu nome" className="bg-emerald-950/40 border-emerald-800/50 text-emerald-50 font-mono" />
        </div>
        {menuPlayers === 2 && (
          <div>
            <label className="mb-1 block font-mono text-[0.65rem] tracking-widest text-emerald-100/50 uppercase">Nome Jogador 2</label>
            <Input value={p2Name} onChange={(e) => setP2Name(e.target.value.slice(0, 12))} maxLength={12}
              placeholder="Nome do P2" className="bg-emerald-950/40 border-emerald-800/50 text-emerald-50 font-mono" />
          </div>
        )}
      </div>

      {modeUsesPowerUps(menuMode) && (
        <div className="mb-5">
          <p className="mb-2 font-mono text-xs tracking-widest text-emerald-100/60 uppercase">Power-ups</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['ghost', 'slow', 'magnet', 'double', 'shield', 'speed', 'shrink', 'freeze'] as PowerUpType[]).map((t) => (
              <PowerUpLegend key={t} type={t} />
            ))}
          </div>
        </div>
      )}

      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-mono text-xs tracking-widest text-emerald-100/60 uppercase flex items-center gap-1.5">
            <Trophy className="size-3.5" /> Ranking online
          </p>
          <Badge variant="outline" className="border-emerald-800/40 text-emerald-100/50 text-[0.6rem]">
            {MODE_LABEL[menuMode]} · {menuPlayers}P
          </Badge>
        </div>
        <LeaderboardList entries={leaderboard} emptyHint="Seja o primeiro a pontuar!" />
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
        <Badge className="bg-emerald-600/90 text-white border-transparent">
          Recorde local: {highScore}
        </Badge>
        {gamepadConnected ? (
          <Badge className="bg-emerald-600/90 text-white border-transparent gap-1.5">
            <Gamepad2 className="size-3" /> Controle conectado
          </Badge>
        ) : (
          <Badge variant="outline" className="border-emerald-800/40 text-emerald-100/50 gap-1.5">
            <Gamepad2 className="size-3" /> Sem controle
          </Badge>
        )}
        <Button variant="outline" size="sm"
          onClick={() => setMuted((m) => !m)}
          className="border-emerald-800/50 bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/40">
          {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          {muted ? 'Som off' : 'Som on'}
        </Button>
      </div>

      <div className="flex justify-center">
        <Button onClick={onStart} size="lg"
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono tracking-widest text-lg px-10">
          <Play className="size-5" /> JOGAR
        </Button>
      </div>

      <p className="mt-4 text-center font-mono text-[0.65rem] text-emerald-100/40">
        Espaço/Enter = pausar · R = reiniciar · M = som · Controle Xbox: D-pad/stick + A/B/Start
      </p>
    </div>
  )
}

function ModeCard({ active, onClick, title, desc, icon }: { active: boolean; onClick: () => void; title: string; desc: string; icon?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={
        'text-left rounded-xl border p-4 transition-all ' +
        (active
          ? 'border-emerald-500 bg-emerald-600/20 shadow-[0_0_20px_-5px_rgba(16,185,129,0.5)]'
          : 'border-emerald-900/40 bg-emerald-950/30 hover:border-emerald-700/60 hover:bg-emerald-900/20')
      }>
      <div className="flex items-center justify-between">
        <span className="font-mono font-bold text-emerald-50 tracking-wide flex items-center gap-1.5">
          {icon && <span className={active ? 'text-emerald-300' : 'text-emerald-100/50'}>{icon}</span>}
          {title}
        </span>
        {active && <span className="text-emerald-400 text-xs">●</span>}
      </div>
      <p className="mt-1 font-mono text-[0.7rem] text-emerald-100/50 leading-relaxed">{desc}</p>
    </button>
  )
}

function PlayerToggle({ active, onClick, icon, label, sub }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; sub: string }) {
  return (
    <button type="button" onClick={onClick}
      className={
        'flex items-center gap-3 rounded-xl border p-3 transition-all ' +
        (active
          ? 'border-emerald-500 bg-emerald-600/20'
          : 'border-emerald-900/40 bg-emerald-950/30 hover:border-emerald-700/60')
      }>
      <span className={active ? 'text-emerald-300' : 'text-emerald-100/50'}>{icon}</span>
      <div className="text-left">
        <div className="font-mono text-sm font-bold text-emerald-50">{label}</div>
        <div className="font-mono text-[0.6rem] text-emerald-100/40">{sub}</div>
      </div>
    </button>
  )
}

function PowerUpLegend({ type }: { type: PowerUpType }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-emerald-900/40 bg-emerald-950/30 p-2">
      <span className="block size-5 rounded" style={{ background: POWERUP_COLORS[type] }} />
      <span className="font-mono text-[0.6rem] text-emerald-100/70 font-bold">{POWERUP_LABEL[type]}</span>
      <span className="font-mono text-[0.55rem] text-emerald-100/40 text-center leading-tight">
        {POWERUP_DESC[type]}
      </span>
    </div>
  )
}

function LeaderboardList({ entries, emptyHint }: { entries: ScoreEntry[]; emptyHint: string }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-4 text-center font-mono text-xs text-emerald-100/30">
        {emptyHint}
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 overflow-hidden">
      {entries.map((e, i) => (
        <div key={e.id} className={
          'flex items-center justify-between px-3 py-2 font-mono text-xs ' +
          (i % 2 === 0 ? 'bg-emerald-950/20' : '')
        }>
          <span className="flex items-center gap-2 text-emerald-100/70">
            <span className={i === 0 ? 'text-amber-400 font-bold' : 'text-emerald-100/40'}>{i + 1}.</span>
            <span className="text-emerald-50">{e.playerName}</span>
          </span>
          <span className="font-bold text-emerald-300">{e.score}</span>
        </div>
      ))}
    </div>
  )
}

/* ================================================================== */
/*  Game view                                                          */
/* ================================================================== */

function GameView(props: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  phase: 'idle' | 'playing' | 'paused' | 'gameover'
  p1Score: number; p2Score: number
  p1Effects: Effects | null; p2Effects: Effects | null
  p1Shield: boolean; p2Shield: boolean
  highScore: number
  config: { mode: Mode; players: 1 | 2; names: [string, string?] }
  winner: { name: string; score: number; tie: boolean } | null
  timeRemaining: number
  muted: boolean; setMuted: (f: boolean | ((p: boolean) => boolean)) => void
  playAgain: () => void; goToMenu: () => void
  togglePause: () => void
  finalBoard: ScoreEntry[]
  gameOverInfo: { submitted: boolean; loading: boolean; saved: boolean }
  onTouchDir: (playerId: 0 | 1, dir: 'up' | 'down' | 'left' | 'right') => void
}) {
  const {
    canvasRef, phase, p1Score, p2Score, p1Effects, p2Effects, p1Shield, p2Shield,
    highScore, config, winner, timeRemaining, muted, setMuted, playAgain, goToMenu, togglePause, finalBoard, gameOverInfo,
    onTouchDir,
  } = props
  const cfg = config
  const showTimer = modeHasTimer(cfg.mode)
  return (
    <div className="w-full max-w-2xl">
      {/* HUD superior */}
      <div className="mb-3 flex items-stretch gap-2">
        <PlayerHud name={cfg.names[0]} score={p1Score} effects={p1Effects} shield={p1Shield} color={PLAYER_COLORS[0]} compact={cfg.players === 2} />
        {cfg.players === 2 && (
          <PlayerHud name={cfg.names[1] ?? 'P2'} score={p2Score} effects={p2Effects} shield={p2Shield} color={PLAYER_COLORS[1]} compact />
        )}
        <div className="flex flex-col items-end justify-center gap-1 px-2">
          {showTimer ? (
            <Badge className={timeRemaining <= 10 ? 'bg-red-600 text-white border-transparent animate-pulse' : 'bg-emerald-600/90 text-white border-transparent'}>
              <Clock className="size-3" /> {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
            </Badge>
          ) : (
            <Badge className="bg-emerald-600/90 text-white border-transparent">HI {highScore}</Badge>
          )}
          <Badge variant="outline" className="border-emerald-800/40 text-emerald-100/50 text-[0.6rem]">
            {MODE_LABEL[cfg.mode]}
          </Badge>
        </div>
      </div>

      {/* Tela LCD */}
      <div className="rounded-2xl p-3 sm:p-4"
        style={{ background: 'linear-gradient(160deg, #0c1a1a, #0a1414)', boxShadow: '0 18px 40px -12px rgba(0,0,0,0.7), inset 0 3px 8px rgba(0,0,0,0.8)' }}>
        <div className="relative rounded-md overflow-hidden" style={{ background: LCD.bg, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)' }}>
          <canvas ref={canvasRef} width={GRID_COLS * CELL} height={GRID_ROWS * CELL}
            className="block w-full h-auto" style={{ imageRendering: 'pixelated' }} aria-label="Tela do jogo" />
          <div className="pointer-events-none absolute inset-0 opacity-25 mix-blend-multiply"
            style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px)' }} />
          <div className="pointer-events-none absolute inset-0"
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 35%, transparent 100%)' }} />

          {phase === 'paused' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ color: LCD.dark }}>
              <span className="font-mono font-extrabold tracking-[0.2em] text-xl" style={{ textShadow: `1px 1px 0 ${LCD.mid}` }}>PAUSA</span>
              <span className="font-mono text-[0.65rem] tracking-widest mt-1" style={{ color: LCD.mid }}>ESPAÇO PARA CONTINUAR</span>
            </div>
          )}

          {phase === 'gameover' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center" style={{ color: LCD.dark, background: 'rgba(174,187,110,0.92)' }}>
              <span className="font-mono font-extrabold tracking-[0.2em] text-lg sm:text-xl" style={{ textShadow: `1px 1px 0 ${LCD.mid}` }}>FIM DE JOGO</span>
              {cfg.players === 2 ? (
                <span className="font-mono text-xs mt-2">
                  {winner?.tie ? (
                    <span>Empate! ({winner.score} pts)</span>
                  ) : winner ? (
                    <span className="flex items-center gap-1 justify-center"><Crown className="size-3" /> {winner.name} venceu! ({winner.score} pts)</span>
                  ) : null}
                </span>
              ) : (
                <span className="font-mono text-xs mt-1">
                  {p1Score >= highScore && p1Score > 0 ? `★ RECORDE! ${p1Score} pts` : `${p1Score} pts`}
                </span>
              )}
              <span className="font-mono text-[0.6rem] mt-1" style={{ color: LCD.mid }}>
                {gameOverInfo.loading
                  ? 'Enviando ao ranking...'
                  : gameOverInfo.submitted
                    ? (gameOverInfo.saved ? '✓ Salvo no ranking online' : '⚠ Ranking indisponível (jogue mesmo assim!)')
                    : ''}
              </span>

              {finalBoard.length > 0 && (
                <div className="mt-3 w-full max-w-[240px]">
                  <div className="font-mono text-[0.55rem] tracking-widest mb-1" style={{ color: LCD.mid }}>TOP 5</div>
                  <div className="space-y-0.5">
                    {finalBoard.slice(0, 5).map((e, i) => (
                      <div key={e.id} className="flex justify-between font-mono text-[0.6rem]">
                        <span><span style={{ color: LCD.mid }}>{i + 1}.</span> {e.playerName}</span>
                        <span className="font-bold">{e.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={playAgain} className="bg-emerald-700 hover:bg-emerald-600 text-white font-mono text-xs">
                  <RotateCcw className="size-3" /> De novo
                </Button>
                <Button size="sm" variant="outline" onClick={goToMenu}
                  className="border-emerald-800/50 bg-transparent text-emerald-900 hover:bg-emerald-800/20 font-mono text-xs">
                  <ArrowLeft className="size-3" /> Menu
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controles */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={togglePause} variant="outline" size="sm"
          className="border-emerald-800/50 bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/40"
          disabled={phase === 'gameover' || phase === 'idle'}>
          {phase === 'paused' ? <><Play className="size-3.5" /> Continuar</> : <><Pause className="size-3.5" /> Pausar</>}
        </Button>
        <Button onClick={playAgain} variant="outline" size="sm"
          className="border-emerald-800/50 bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/40">
          <RotateCcw className="size-3.5" /> Reiniciar
        </Button>
        <Button onClick={() => setMuted((m) => !m)} variant="outline" size="sm"
          className="border-emerald-800/50 bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/40">
          {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
        </Button>
        <Button onClick={goToMenu} variant="outline" size="sm"
          className="border-emerald-800/50 bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/40">
          <ArrowLeft className="size-3.5" /> Menu
        </Button>
      </div>

      {/* Controles de toque (somente mobile / touchscreen) */}
      <TouchControls
        visible={phase !== 'gameover' && phase !== 'idle'}
        players={cfg.players}
        onDir={onTouchDir}
      />

      {modeUsesPowerUps(cfg.mode) && phase !== 'gameover' && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className="font-mono text-[0.6rem] text-emerald-100/40">Power-ups:</span>
          {(['ghost', 'slow', 'magnet', 'double', 'shield', 'speed', 'shrink', 'freeze'] as PowerUpType[]).map((t) => (
            <span key={t} className="flex items-center gap-1 font-mono text-[0.6rem] text-emerald-100/60">
              <span className="inline-block size-2 rounded-sm" style={{ background: POWERUP_COLORS[t] }} />
              {POWERUP_LABEL[t]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function PlayerHud({ name, score, effects, shield, color, compact }: {
  name: string; score: number; effects: Effects | null; shield: boolean; color: string; compact?: boolean
}) {
  const now = typeof performance !== 'undefined' ? performance.now() : 0
  const active = effects
    ? (['ghost', 'slow', 'magnet', 'double', 'speed', 'freeze'] as PowerUpType[]).filter((t) => effects[t] > now)
    : []
  return (
    <div className={'flex-1 rounded-lg border border-emerald-900/40 bg-emerald-950/30 p-2 ' + (compact ? 'min-w-0' : '')}>
      <div className="flex items-center gap-2">
        <span className="inline-block size-3 rounded-sm shrink-0" style={{ background: color }} />
        <span className="font-mono text-[0.65rem] sm:text-xs text-emerald-100/70 truncate">{name}</span>
        {shield && (
          <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-mono text-[0.5rem] font-bold text-black"
            style={{ background: POWERUP_COLORS.shield }}>
            <Shield className="size-2.5" />
          </span>
        )}
        <span className="ml-auto font-mono text-lg sm:text-xl font-bold text-emerald-200 tabular-nums">{score}</span>
      </div>
      {active.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {active.map((t) => (
            <EffectBadge key={t} type={t} expiry={effects![t]} />
          ))}
        </div>
      )}
    </div>
  )
}

function EffectBadge({ type, expiry }: { type: PowerUpType; expiry: number }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((expiry - performance.now()) / 1000)))
  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((expiry - performance.now()) / 1000)))
    }, 200)
    return () => window.clearInterval(id)
  }, [expiry])
  const icon = type === 'ghost' ? <Ghost className="size-3" />
    : type === 'slow' ? <Snail className="size-3" />
    : type === 'magnet' ? <Magnet className="size-3" />
    : type === 'double' ? <Star className="size-3" />
    : type === 'speed' ? <Zap className="size-3" />
    : type === 'freeze' ? <Snowflake className="size-3" />
    : <Star className="size-3" />
  return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[0.55rem] font-bold text-black"
      style={{ background: POWERUP_COLORS[type] }}>
      {icon}
      {remaining}s
    </span>
  )
}

/* ================================================================== */
/*  Controles de toque (D-pad virtual) — só aparece em touchscreen     */
/* ================================================================== */

function TouchControls({
  visible, players, onDir,
}: {
  visible: boolean
  players: 1 | 2
  onDir: (playerId: 0 | 1, dir: 'up' | 'down' | 'left' | 'right') => void
}) {
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    // Detecta se o dispositivo tem touchscreen (celular/tablet)
    const hasTouch =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsTouch(hasTouch)
  }, [])

  if (!isTouch || !visible) return null

  return (
    <div className="mt-4 flex items-start justify-around gap-4 select-none">
      <DPad label={players === 2 ? 'P1' : 'MOVER'} onDir={(d) => onDir(0, d)} />
      {players === 2 && <DPad label="P2" onDir={(d) => onDir(1, d)} />}
    </div>
  )
}

function DPad({ label, onDir }: {
  label: string
  onDir: (dir: 'up' | 'down' | 'left' | 'right') => void
}) {
  // prevenimos context menu e seleção; usamos onPointerDown para resposta imediata
  const press = (dir: 'up' | 'down' | 'left' | 'right') => (e: React.PointerEvent) => {
    e.preventDefault()
    onDir(dir)
  }
  const btnCls =
    'flex items-center justify-center bg-emerald-800/70 active:bg-emerald-500 text-emerald-50 ' +
    'rounded-lg touch-none select-none backdrop-blur shadow-lg ' +
    'transition-colors'
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="font-mono text-[0.6rem] tracking-widest text-emerald-100/50">{label}</span>
      <div className="grid grid-cols-3 grid-rows-3 gap-1.5" style={{ width: 168, height: 168 }}>
        <span />
        <button type="button" aria-label="Cima"
          onPointerDown={press('up')}
          onContextMenu={(e) => e.preventDefault()}
          className={btnCls}>
          <Chevron dir="up" />
        </button>
        <span />
        <button type="button" aria-label="Esquerda"
          onPointerDown={press('left')}
          onContextMenu={(e) => e.preventDefault()}
          className={btnCls}>
          <Chevron dir="left" />
        </button>
        <span className="flex items-center justify-center text-emerald-200/30">
          <span className="size-2 rounded-full bg-emerald-300/40" />
        </span>
        <button type="button" aria-label="Direita"
          onPointerDown={press('right')}
          onContextMenu={(e) => e.preventDefault()}
          className={btnCls}>
          <Chevron dir="right" />
        </button>
        <span />
        <button type="button" aria-label="Baixo"
          onPointerDown={press('down')}
          onContextMenu={(e) => e.preventDefault()}
          className={btnCls}>
          <Chevron dir="down" />
        </button>
        <span />
      </div>
    </div>
  )
}

function Chevron({ dir }: { dir: 'up' | 'down' | 'left' | 'right' }) {
  const rot = { up: '0deg', right: '90deg', down: '180deg', left: '270deg' }[dir]
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: `rotate(${rot})` }}>
      <path d="M18 15l-6-6-6 6" />
    </svg>
  )
}
