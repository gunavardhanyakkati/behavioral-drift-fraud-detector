import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react'
import { api, streamPipeline } from './api'
import { BANKS, num, pct, kb } from './theme'

const PipelineContext = createContext(null)

export const STAGES = [
  { id: 'generate', label: 'Generate data' },
  { id: 'partition', label: 'Split into banks' },
  { id: 'federated', label: 'Federated rounds' },
  { id: 'profiles', label: 'Local profiles' },
  { id: 'evaluate', label: 'Evaluate' },
]

const freshBanks = () => Object.fromEntries(BANKS.map((b) => [b, { status: 'idle', detail: null, samples: null }]))

const initialRun = {
  running: false,
  done: false,
  error: null,
  seconds: null,
  stages: Object.fromEntries(STAGES.map((s) => [s.id, 'idle'])),
  dataset: null,
  partition: null,
  init: null,
  currentRound: 0,
  totalRounds: 0,
  server: 'idle',
  banks: freshBanks(),
  rounds: [],
  flow: null,
  shares: null,
  profiles: {},
  evaluation: null,
  bytesSent: 0,
  log: [],
}

let flowId = 0

function withLog(state, kind, text) {
  const t = new Date().toLocaleTimeString('en-GB', { hour12: false })
  return { ...state, log: [...state.log.slice(-160), { id: `${Date.now()}-${Math.random()}`, t, kind, text }] }
}

function reducer(state, ev) {
  switch (ev.type) {
    case 'reset':
      return { ...initialRun, running: true, log: [], banks: freshBanks() }
    case 'stage': {
      const s = { ...state, stages: { ...state.stages, [ev.stage]: ev.status } }
      const label = STAGES.find((x) => x.id === ev.stage)?.label
      return ev.status === 'running' ? withLog(s, 'stage', `▶ ${label}`) : s
    }
    case 'dataset':
      return withLog({ ...state, dataset: ev }, 'info',
        `Generated ${num(ev.total)} synthetic transactions · ${num(ev.users)} users · ${num(ev.fraud)} injected frauds`)
    case 'partition': {
      const { type, ...banks } = ev
      let s = { ...state, partition: banks }
      for (const b of BANKS) {
        s = withLog(s, 'bank', `${b}: received ${num(banks[b].total_txns)} txns of its own customers (${banks[b].unique_users} users)`)
      }
      return s
    }
    case 'fl_init': {
      const banks = freshBanks()
      for (const b of BANKS) banks[b].samples = ev.clients[b]?.train
      return withLog({ ...state, init: ev, totalRounds: ev.rounds, banks }, 'server',
        `Server initialised global model: ${ev.in_features} inputs → 64 → 32 → 1 (${num(ev.num_params)} parameters)`)
    }
    case 'round_start':
      return withLog({
        ...state,
        currentRound: ev.round,
        rounds: [...state.rounds, { round: ev.round, banks: {} }],
        banks: Object.fromEntries(BANKS.map((b) => [b, { ...state.banks[b], status: 'idle' }])),
      }, 'round', `── Round ${ev.round} of ${state.totalRounds} ──`)
    case 'broadcast':
      return withLog({
        ...state,
        server: 'broadcasting',
        flow: { id: ++flowId, kind: 'broadcast' },
        bytesSent: state.bytesSent + ev.payload_bytes * BANKS.length,
        banks: Object.fromEntries(BANKS.map((b) => [b, { ...state.banks[b], status: 'receiving' }])),
      }, 'server', `Server → all banks: global weights W${sub(ev.round - 1)} (${kb(ev.payload_bytes)} each)`)
    case 'client_training':
      return withLog({
        ...state,
        server: 'waiting',
        banks: { ...state.banks, [ev.bank]: { ...state.banks[ev.bank], status: 'training', samples: ev.samples } },
      }, 'bank', `${ev.bank}: training locally on ${num(ev.samples)} private txns for ${ev.epochs} epochs`)
    case 'client_done': {
      const { type, round, bank, payload_bytes, ...detail } = ev
      const rounds = state.rounds.map((r) => (r.round === round ? { ...r, banks: { ...r.banks, [bank]: detail } } : r))
      return withLog({
        ...state,
        rounds,
        flow: { id: ++flowId, kind: 'upload', bank },
        bytesSent: state.bytesSent + payload_bytes,
        banks: { ...state.banks, [bank]: { ...state.banks[bank], status: 'sent', detail } },
      }, 'bank', `${bank} → server: weight update only (val acc ${pct(detail.val_acc)}, loss ${detail.val_loss.toFixed(4)}) · 0 raw rows`)
    }
    case 'aggregating':
      return withLog({ ...state, server: 'aggregating', shares: ev.shares }, 'server',
        `Server: FedAvg  W = ${BANKS.map((b) => `${ev.shares[b].toFixed(2)}·W(${b.slice(-1)})`).join(' + ')}`)
    case 'aggregate': {
      const rounds = state.rounds.map((r) => (r.round === ev.round
        ? { ...r, global_loss: ev.global_loss, global_acc: ev.global_acc, shares: ev.shares } : r))
      return withLog({
        ...state,
        rounds,
        server: 'idle',
        banks: Object.fromEntries(BANKS.map((b) => [b, { ...state.banks[b], status: 'synced' }])),
      }, 'success', `Round ${ev.round} complete → global accuracy ${pct(ev.global_acc, 2)}, loss ${ev.global_loss.toFixed(4)}`)
    }
    case 'profiles':
      return withLog({ ...state, profiles: { ...state.profiles, [ev.bank]: ev.count } }, 'bank',
        `${ev.bank}: built ${ev.count} behavioral profiles locally (never shared)`)
    case 'evaluation': {
      const { type, ...rest } = ev
      return withLog({ ...state, evaluation: rest }, 'success',
        `Held-out test (${num(rest.test_size)} txns): FL+Drift accuracy ${pct(rest.fused.accuracy, 2)}, precision ${pct(rest.fused.precision)}`)
    }
    case 'done':
      return withLog({ ...state, running: false, done: true, seconds: ev.seconds }, 'success',
        `✔ Pipeline finished in ${ev.seconds}s — new global model is live`)
    case 'error':
      return withLog({ ...state, running: false, error: ev.message }, 'error', `✖ ${ev.message}`)
    default:
      return state
  }
}

function sub(n) {
  return String(n).split('').map((d) => '₀₁₂₃₄₅₆₇₈₉'[+d]).join('')
}

export function PipelineProvider({ children }) {
  const [run, dispatch] = useReducer(reducer, initialRun)
  const [status, setStatus] = useState(null)
  const [overview, setOverview] = useState(null)
  const [backendDown, setBackendDown] = useState(false)
  const abortRef = useRef(null)

  const refreshStatus = useCallback(async () => {
    try {
      const s = await api.status()
      setStatus(s)
      setBackendDown(false)
      return s
    } catch {
      setBackendDown(true)
      return null
    }
  }, [])

  const ready = status?.status === 'ready' || (status?.model != null && status?.status !== 'error')
  const modelVersion = status?.model?.trained_at ?? null

  useEffect(() => {
    refreshStatus()
    const id = setInterval(refreshStatus, ready ? 8000 : 1500)
    return () => clearInterval(id)
  }, [refreshStatus, ready])

  useEffect(() => {
    if (!modelVersion) return
    api.overview().then(setOverview).catch(() => {})
  }, [modelVersion])

  const start = useCallback(async ({ rounds = 3, epochs = 3, pace = 1 } = {}) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    dispatch({ type: 'reset' })
    try {
      await streamPipeline({ rounds, epochs, pace }, (ev) => dispatch(ev), ctrl.signal)
    } catch (e) {
      if (e.name !== 'AbortError') dispatch({ type: 'error', message: e.message })
    } finally {
      refreshStatus()
    }
  }, [refreshStatus])

  return (
    <PipelineContext.Provider value={{ run, start, status, ready, overview, modelVersion, backendDown }}>
      {children}
    </PipelineContext.Provider>
  )
}

export const usePipeline = () => useContext(PipelineContext)
