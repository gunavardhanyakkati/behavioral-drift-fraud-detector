import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ArrowRight, Building2, Check, Loader2, Lock, Play, Server, Terminal, Upload, Download, Sigma,
} from 'lucide-react'
import { Button, Card, CardHeader, ChartTooltip, Legend, PageHeader, Segmented } from '../components/ui'
import { STAGES, usePipeline } from '../lib/pipeline'
import { BANKS, BANK_COLORS, C, chartAxis, kb, num, pct } from '../lib/theme'

const POS = {
  server: { left: 50, top: 17 },
  'Bank A': { left: 17, top: 74 },
  'Bank B': { left: 50, top: 74 },
  'Bank C': { left: 83, top: 74 },
}

const BANK_STATUS = {
  idle: { text: 'Idle', color: '#64748b' },
  receiving: { text: 'Got W', color: C.fl },
  training: { text: 'Training', color: '#f2bf4a' },
  sent: { text: 'ΔW sent', color: '#22c55e' },
  synced: { text: 'Synced', color: '#22c55e' },
}

const SERVER_STATUS = {
  idle: 'Waiting',
  broadcasting: 'Broadcasting global weights',
  waiting: 'Waiting for bank updates',
  aggregating: 'FedAvg aggregation',
}

export default function Federated({ go }) {
  const { run, start, overview, status } = usePipeline()
  const [rounds, setRounds] = useState(3)
  const [epochs, setEpochs] = useState(3)
  const [pace, setPace] = useState(1)

  const live = run.running || run.done || run.error
  const lastModel = overview?.model

  const chartData = useMemo(() => {
    const src = live ? run.rounds : lastModel?.round_details || []
    return src
      .filter((r) => r.global_acc != null || Object.keys(r.banks || {}).length)
      .map((r) => ({
        round: `R${r.round}`,
        global: r.global_acc,
        ...Object.fromEntries(BANKS.map((b) => [b, r.banks?.[b]?.val_acc])),
      }))
  }, [live, run.rounds, lastModel])

  const totalRounds = live ? run.totalRounds || rounds : lastModel?.config?.rounds || 3
  const currentRound = live ? run.currentRound : lastModel?.config?.rounds || 0
  const lastRound = (live ? run.rounds : lastModel?.round_details || []).filter((r) => r.global_acc != null).slice(-1)[0]
  const payload = run.init?.payload_bytes || lastModel?.payload_bytes || 16396
  const rawKb = overview?.raw_size_kb

  return (
    <div>
      <PageHeader step={2} eyebrow="Flower + PyTorch · FedAvg" title="Federated training: learn together, share nothing">
        The server sends the current global model to every bank. Each bank trains on its own private transactions and returns
        only the updated weights. The server averages them, weighted by data size (FedAvg), and repeats.
      </PageHeader>

      {/* Controls + stages */}
      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2 text-[12.5px] text-slate-400">
            Rounds <Segmented options={[1, 2, 3, 4, 5]} value={rounds} onChange={setRounds} />
          </div>
          <div className="flex items-center gap-2 text-[12.5px] text-slate-400">
            Local epochs <Segmented options={[1, 2, 3, 4, 5]} value={epochs} onChange={setEpochs} />
          </div>
          <div className="flex items-center gap-2 text-[12.5px] text-slate-400">
            Speed <Segmented options={[{ value: 1, label: 'Presentation' }, { value: 0, label: 'Real-time' }]} value={pace} onChange={setPace} />
          </div>
          <Button className="ml-auto" icon={Play} loading={run.running} disabled={run.running || status?.busy}
            onClick={() => start({ rounds, epochs, pace })}>
            {run.running ? 'Training…' : live ? 'Run again' : 'Run federated training'}
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
          {STAGES.map((s, i) => {
            const st = run.stages[s.id]
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors ${
                  st === 'running' ? 'bg-amber-400/10 text-amber-100 ring-1 ring-amber-300/40' : st === 'done' ? 'text-emerald-200' : 'text-slate-500'}`}>
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold ${
                    st === 'done' ? 'bg-emerald-400/20 text-emerald-300' : st === 'running' ? 'bg-amber-300/20' : 'bg-white/[0.06]'}`}>
                    {st === 'done' ? <Check size={12} /> : st === 'running' ? <Loader2 size={12} className="animate-spin" /> : i + 1}
                  </span>
                  {s.label}
                  {s.id === 'federated' && st === 'running' && <span className="font-mono text-[11px] text-amber-200/80">{run.currentRound}/{run.totalRounds}</span>}
                </div>
                {i < STAGES.length - 1 && <span className="h-px w-5 bg-white/10" />}
              </div>
            )
          })}
          {!live && lastModel && (
            <span className="ml-auto text-[12px] text-slate-500">
              Showing the model trained at server start ({lastModel.config.rounds} rounds × {lastModel.config.local_epochs} epochs, seed {lastModel.config.seed}). Press run to watch it live.
            </span>
          )}
          {run.done && <span className="ml-auto text-[12px] text-emerald-300">Finished in {run.seconds}s — the analyzer now uses this model.</span>}
          {run.error && <span className="ml-auto text-[12px] text-rose-300">{run.error}</span>}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,1fr)]">
        {/* Network */}
        <Card className="flex flex-col overflow-hidden p-0">
          <div className="relative min-h-[560px] w-full flex-1">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {BANKS.map((b) => {
                const s = POS.server, p = POS[b]
                const active = run.server === 'broadcasting' || (run.flow?.kind === 'upload' && run.flow.bank === b && run.banks[b].status === 'sent')
                const color = run.server === 'broadcasting' ? C.fl : BANK_COLORS[b]
                return (
                  <g key={b}>
                    <line x1={s.left} y1={s.top + 6} x2={p.left} y2={p.top - 9} stroke="#253049" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    {active && (
                      <line x1={s.left} y1={s.top + 6} x2={p.left} y2={p.top - 9} stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" className="dash-flow" />
                    )}
                  </g>
                )
              })}
            </svg>

            {/* Packets */}
            <AnimatePresence>
              {run.flow?.kind === 'broadcast' && BANKS.map((b) => (
                <Packet key={`${run.flow.id}-${b}`} from={POS.server} to={POS[b]} color={C.fl} label="W global" icon={Download} />
              ))}
              {run.flow?.kind === 'upload' && (
                <Packet key={`${run.flow.id}`} from={POS[run.flow.bank]} to={POS.server} color={BANK_COLORS[run.flow.bank]} label={`ΔW · ${kb(payload)}`} icon={Upload} />
              )}
            </AnimatePresence>

            {/* Server */}
            <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${POS.server.left}%`, top: `${POS.server.top}%` }}>
              <ServerNode state={run.server} round={currentRound} total={totalRounds} shares={run.server === 'aggregating' ? run.shares : null} />
            </div>

            {/* Banks */}
            {BANKS.map((b) => (
              <div key={b} className="absolute w-[30%] max-w-[250px] -translate-x-1/2 -translate-y-1/2" style={{ left: `${POS[b].left}%`, top: `${POS[b].top}%` }}>
                <BankNode bank={b} state={run.banks[b]} fallbackRows={overview?.banks?.[b]?.total_txns} live={live} lastDetail={lastModel?.round_details?.slice(-1)[0]?.banks?.[b]} />
              </div>
            ))}

            {/* Transmission strip */}
            <div className="absolute inset-x-0 bottom-0 grid grid-cols-2 border-t border-white/[0.06] bg-ink-950/50 backdrop-blur">
              <div className="flex items-center gap-3 px-5 py-3">
                <Upload size={16} className="text-sky-300" />
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">Model weights transmitted</div>
                  <div className="font-mono text-[15px] text-white">{kb(live ? run.bytesSent : payload * BANKS.length * 2 * totalRounds)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 border-l border-white/[0.06] px-5 py-3">
                <Lock size={16} className="text-emerald-300" />
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">Raw transactions transmitted</div>
                  <div className="font-mono text-[15px] text-emerald-300">0 rows <span className="text-[12px] text-slate-500">· {rawKb ? `${rawKb} KB` : 'all'} stayed in the banks</span></div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[11.5px] uppercase tracking-wider text-slate-500">Federated round</div>
                <div className="text-[30px] font-semibold leading-none text-white">
                  {currentRound || '–'}<span className="text-[18px] text-slate-500"> / {totalRounds}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11.5px] uppercase tracking-wider text-slate-500">Global accuracy</div>
                <div className="text-[30px] font-semibold leading-none text-white">{lastRound ? pct(lastRound.global_acc, 2) : '—'}</div>
                <div className="mt-1 text-[11.5px] text-slate-500">val. loss {lastRound ? lastRound.global_loss.toFixed(4) : '—'}</div>
              </div>
            </div>
            <div className="mt-4 flex gap-1.5">
              {Array.from({ length: totalRounds }).map((_, i) => {
                const r = i + 1
                const done = (live ? run.rounds : lastModel?.round_details || []).some((x) => x.round === r && x.global_acc != null)
                const active = live && run.running && r === run.currentRound && !done
                return (
                  <div key={r} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                    {done && <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} className="h-full bg-emerald-400/80" />}
                    {active && <div className="h-full w-full shimmer bg-amber-300/40" />}
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="p-5">
            <CardHeader title="Validation accuracy per round" subtitle="Each bank’s held-out split, and their average (global)" />
            <div className="mb-2">
              <Legend items={[{ label: 'Global', color: '#e6e9f2', line: true }, ...BANKS.map((b) => ({ label: b, color: BANK_COLORS[b], line: true }))]} />
            </div>
            <div className="h-[180px]">
              {chartData.length ? (
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis dataKey="round" {...chartAxis} />
                    <YAxis {...chartAxis} domain={['dataMin - 0.01', 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                    <Tooltip content={<ChartTooltip valueFormatter={(v) => pct(v, 2)} />} />
                    {BANKS.map((b) => (
                      <Line key={b} type="monotone" dataKey={b} name={b} stroke={BANK_COLORS[b]} strokeWidth={2} dot={{ r: 3.5, strokeWidth: 0, fill: BANK_COLORS[b] }} isAnimationActive={false} connectNulls />
                    ))}
                    <Line type="monotone" dataKey="global" name="Global" stroke="#e6e9f2" strokeWidth={2.5} dot={{ r: 4.5, strokeWidth: 2, stroke: '#0f1524', fill: '#e6e9f2' }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="grid h-full place-items-center text-[13px] text-slate-500">Waiting for the first round…</div>
              )}
            </div>
          </Card>

          <EventLog log={run.log} live={live} />
        </div>
      </div>

      {run.done && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] p-5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300"><Check size={20} /></div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-white">New global model is live</div>
            <div className="text-[13px] text-slate-300">
              {run.totalRounds} rounds · {num(run.init?.num_params)} parameters · {kb(run.bytesSent)} of weights exchanged · 0 customer records shared.
            </div>
          </div>
          <Button icon={ArrowRight} onClick={() => go('profiles')}>Next: behavioral profiles</Button>
        </motion.div>
      )}

      {/* FedAvg explainer */}
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {[
          { icon: Download, color: C.fl, title: '1 · Broadcast', text: 'Server sends the current global weights W to every bank (~16 KB).' },
          { icon: Building2, color: '#f2bf4a', title: '2 · Local training', text: 'Each bank runs a few epochs of Adam on its own data. Raw rows never leave.' },
          { icon: Sigma, color: '#22c55e', title: '3 · FedAvg', text: 'W = Σ (nₖ / N) · Wₖ — banks with more data get proportionally more say.' },
        ].map((s) => (
          <Card key={s.title} className="p-5">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${s.color}22`, color: s.color }}><s.icon size={16} /></div>
              <div className="text-[14px] font-semibold text-white">{s.title}</div>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{s.text}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}

function Packet({ from, to, color, label, icon: Icon }) {
  return (
    <motion.div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
      initial={{ left: `${from.left}%`, top: `${from.top + (from.top < 50 ? 8 : -10)}%`, opacity: 0, scale: 0.7 }}
      animate={{ left: `${to.left}%`, top: `${to.top + (to.top < 50 ? 8 : -10)}%`, opacity: [0, 1, 1, 0], scale: [0.7, 1, 1, 0.8] }}
      transition={{ duration: 1.1, ease: 'easeInOut', times: [0, 0.15, 0.8, 1] }}
    >
      <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold text-white"
        style={{ background: color, boxShadow: `0 0 24px ${color}` }}>
        <Icon size={11} /> {label}
      </div>
    </motion.div>
  )
}

function ServerNode({ state, round, total, shares }) {
  const active = state !== 'idle'
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {active && <span className="absolute inset-0 rounded-2xl pulse-ring" style={{ boxShadow: `0 0 0 2px ${state === 'aggregating' ? '#22c55e' : C.fl}` }} />}
        <div className="relative flex items-center gap-3 rounded-2xl border bg-ink-900/90 px-5 py-3.5 backdrop-blur"
          style={{ borderColor: active ? `${C.fl}aa` : 'rgba(255,255,255,0.1)', boxShadow: active ? `0 0 50px -10px ${C.fl}` : undefined }}>
          <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${C.fl}26`, color: C.flSoft }}>
            {state === 'aggregating' ? <Sigma size={20} /> : <Server size={20} />}
          </div>
          <div>
            <div className="text-[14px] font-semibold text-white">Flower FL Server</div>
            <div className="text-[12px] text-slate-400">{SERVER_STATUS[state]}{round ? ` · round ${round}/${total}` : ''}</div>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {shares && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 w-[280px]">
            <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
              {BANKS.map((b) => <div key={b} style={{ width: `${shares[b] * 100}%`, background: BANK_COLORS[b] }} />)}
            </div>
            <div className="mt-1 flex justify-between font-mono text-[10.5px] text-slate-400">
              {BANKS.map((b) => <span key={b}>{b.slice(-1)}: {(shares[b] * 100).toFixed(1)}%</span>)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function BankNode({ bank, state, fallbackRows, live, lastDetail }) {
  const color = BANK_COLORS[bank]
  const st = BANK_STATUS[state.status] || BANK_STATUS.idle
  const detail = state.detail || (!live ? lastDetail : null)
  const training = state.status === 'training'
  return (
    <motion.div
      animate={{ scale: training ? 1.04 : 1 }}
      className="rounded-2xl border bg-ink-900/90 p-3.5 backdrop-blur"
      style={{ borderColor: training ? color : `${color}55`, boxShadow: training ? `0 0 40px -8px ${color}` : undefined }}
    >
      <div className="flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `${color}26`, color }}><Building2 size={14} /></div>
        <div className="whitespace-nowrap text-[13.5px] font-semibold text-white">{bank}</div>
        <span className="ml-auto inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10.5px] font-medium" style={{ background: `${st.color}1f`, color: '#e6e9f2' }}>
          {training ? <Loader2 size={10} className="animate-spin" style={{ color: st.color }} /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />}
          {st.text}
        </span>
      </div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        {training && <div className="h-full w-full shimmer" style={{ backgroundColor: `${color}66` }} />}
        {(state.status === 'sent' || state.status === 'synced') && <div className="h-full w-full" style={{ background: color }} />}
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[11.5px]">
        <span className="flex items-center gap-1 text-slate-400"><Lock size={11} className="text-emerald-300/80" />{num(state.samples || (fallbackRows ? Math.round(fallbackRows * 0.8) : null))} private rows</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 font-mono text-[11.5px]">
        <div><span className="text-slate-500">acc </span><span className="text-slate-100">{detail ? pct(detail.val_acc, 1) : '—'}</span></div>
        <div><span className="text-slate-500">loss </span><span className="text-slate-100">{detail ? detail.val_loss.toFixed(3) : '—'}</span></div>
      </div>
    </motion.div>
  )
}

const LOG_COLORS = { stage: '#f2bf4a', server: C.flSoft, bank: '#cbd2e1', round: '#8b93a7', success: '#4ade80', error: C.fraud, info: '#cbd2e1' }

function EventLog({ log, live }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [log.length])
  return (
    <Card className="flex min-h-0 flex-1 flex-col p-0">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5 text-[12px] text-slate-400">
        <Terminal size={14} /> Live event stream <span className="ml-auto font-mono text-[10.5px] text-slate-600">GET /api/pipeline/run · SSE</span>
      </div>
      <div ref={ref} className="h-[230px] overflow-y-auto px-4 py-3 font-mono text-[11.5px] leading-[1.7]">
        {!live && <div className="text-slate-500">Press “Run federated training” to stream a live session from the backend.</div>}
        {log.map((l) => (
          <motion.div key={l.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2">
            <span className="shrink-0 text-slate-600">{l.t}</span>
            <span style={{ color: LOG_COLORS[l.kind] || '#cbd2e1' }}>{l.text}</span>
          </motion.div>
        ))}
      </div>
    </Card>
  )
}
