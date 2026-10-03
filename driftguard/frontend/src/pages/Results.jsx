import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CartesianGrid, Customized, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts'
import { Brain, Building2, Fingerprint, Info, Sigma, TrendingUp } from 'lucide-react'
import { Card, CardHeader, ChartTooltip, Legend, Loading, PageHeader, Slider, WarmingUp } from '../components/ui'
import { api } from '../lib/api'
import { usePipeline } from '../lib/pipeline'
import { C, chartAxis, inr, num, pct, pretty } from '../lib/theme'

const MODELS = [
  { key: 'local', title: 'Local-only', short: 'Local-only', sub: 'Each bank trains alone · no federation', color: '#6b7280', icon: Building2 },
  { key: 'federated', title: 'Federated (global model)', short: 'Federated', sub: 'FedAvg across 3 banks · threshold on P', color: C.fl, icon: Brain },
  { key: 'fused', title: 'Federated + behavioral drift', short: 'Fed + drift', sub: 'The full system · α = 0.7', color: C.fuse, icon: Sigma },
]

function Delta({ label, from, to }) {
  const diff = to.v - from.v
  const better = diff < 0
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-2.5 text-[12.5px]">
      <span className="w-28 shrink-0 text-slate-400">{label}</span>
      <span className="text-slate-400">{from.name} <span className="font-mono text-slate-100">{from.v}</span></span>
      <span className="text-slate-600">→</span>
      <span className="text-slate-400">{to.name} <span className="font-mono text-slate-100">{to.v}</span></span>
      <span className={`ml-auto font-medium ${diff === 0 ? 'text-slate-500' : better ? 'text-emerald-300' : 'text-rose-300'}`}>
        {diff === 0 ? 'no change' : `${better ? '▼' : '▲'} ${Math.abs(diff)}${from.v ? ` (${Math.round((Math.abs(diff) / from.v) * 100)}%)` : ''}`}
      </span>
    </div>
  )
}
const METRIC_COLORS = { precision: '#199e70', recall: '#d95926', f1: '#9085e9' }

function metricsAt(points, alpha, threshold) {
  let tp = 0, fp = 0, fn = 0, tn = 0
  for (const p of points) {
    const pred = alpha * p.p + (1 - alpha) * p.s >= threshold ? 1 : 0
    if (pred && p.y) tp++
    else if (pred && !p.y) fp++
    else if (!pred && p.y) fn++
    else tn++
  }
  const precision = tp + fp ? tp / (tp + fp) : 0
  const recall = tp + fn ? tp / (tp + fn) : 0
  return { tp, fp, fn, tn, precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0, accuracy: (tp + tn) / points.length }
}

export default function Results() {
  const { ready, status, modelVersion } = usePipeline()
  const [ev, setEv] = useState(null)
  const [alpha, setAlpha] = useState(0.7)

  useEffect(() => {
    if (ready) api.evaluation().then(setEv).catch(() => {})
  }, [ready, modelVersion])

  const live = useMemo(() => (ev ? metricsAt(ev.points, alpha, ev.threshold) : null), [ev, alpha])
  const best = useMemo(() => (ev ? ev.alpha_sweep.reduce((a, b) => (b.f1 > a.f1 ? b : a)) : null), [ev])

  if (!ready) return <WarmingUp status={status} />
  if (!ev) return <Loading label="Scoring held-out transactions…" />

  const m = ev.models

  return (
    <div>
      <PageHeader step={6} eyebrow="Evaluation" title="Does it actually work?">
        Measured on <span className="text-slate-200">{num(ev.test_size)} held-out transactions</span> ({ev.fraud_count} frauds) — each
        bank’s 20% validation split, never used for training. All three systems are trained and scored live by the backend.
      </PageHeader>

      {/* Model cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        {MODELS.map((mod, i) => {
          const r = m[mod.key]
          const prev = i > 0 ? m[MODELS[i - 1].key] : null
          return (
            <motion.div key={mod.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="h-full p-5" glow={i === 2 ? C.fuse : undefined}>
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${mod.color}26`, color: mod.color }}><mod.icon size={17} /></div>
                  <div>
                    <div className="text-[15px] font-semibold text-white">{mod.title}</div>
                    <div className="text-[12px] text-slate-400">{mod.sub}</div>
                  </div>
                  {i === 2 && <span className="ml-auto rounded-md bg-amber-400/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-amber-200">This project</span>}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
                  <Metric label="Precision" value={r.precision} prev={prev?.precision} />
                  <Metric label="Recall" value={r.recall} prev={prev?.recall} />
                  <Metric label="F1 score" value={r.f1} prev={prev?.f1} />
                  <Metric label="Accuracy" value={r.accuracy} prev={prev?.accuracy} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2"><span className="text-slate-500">Frauds caught </span><span className="font-mono text-white">{r.tp}/{r.tp + r.fn}</span></div>
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2"><span className="text-slate-500">False alarms </span><span className="font-mono text-white">{r.fp}</span></div>
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* Fraud type breakdown */}
        <Card className="p-6">
          <CardHeader icon={TrendingUp} title="Which frauds get caught?" subtitle="Recall split by the two fraud types the generator injects" />
          {[
            { key: 'global_anomaly', title: 'Global anomalies', desc: 'huge · 1–4 AM · far from home' },
            { key: 'personalized_anomaly', title: 'Personalized anomalies', desc: '4–8× the customer’s own average, at normal hours' },
          ].map((t) => {
            const d = ev.by_type[t.key]
            const rows = [
              { k: 'local', label: 'Local-only', color: '#6b7280' },
              { k: 'federated', label: 'Federated', color: C.fl },
              { k: 'fused', label: 'Federated + drift (α 0.7)', color: C.fuse },
              { k: 'drift_only', label: 'Drift score alone', color: C.drift },
            ]
            return (
              <div key={t.key} className="mb-6 last:mb-0">
                <div className="mb-2.5 flex items-baseline gap-2">
                  <span className="text-[14px] font-semibold text-white">{t.title}</span>
                  <span className="text-[12px] text-slate-500">{t.desc} · {d.local.total} in test set</span>
                </div>
                <div className="space-y-2">
                  {rows.map((row) => {
                    const v = d[row.k]
                    const share = v.total ? v.caught / v.total : 0
                    return (
                      <div key={row.k} className="flex items-center gap-3">
                        <span className="w-44 shrink-0 text-[12.5px] text-slate-300">{row.label}</span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                          <motion.div className="h-full rounded-full" style={{ background: row.color }} initial={{ width: 0 }} animate={{ width: `${share * 100}%` }} transition={{ duration: 0.7 }} />
                        </div>
                        <span className="w-20 text-right font-mono text-[12.5px] text-slate-200">{v.caught}/{v.total} <span className="text-slate-500">{Math.round(share * 100)}%</span></span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          <div className="mt-5 flex gap-2 rounded-xl bg-white/[0.03] p-3 text-[12.5px] leading-relaxed text-slate-400">
            <Info size={15} className="mt-0.5 shrink-0 text-slate-500" />
            <span>
              {m.federated.recall > m.local.recall
                ? `Federation lifts overall recall from ${pct(m.local.recall)} (isolated banks) to ${pct(m.federated.recall)}. `
                : `Overall recall: ${pct(m.local.recall)} isolated vs ${pct(m.federated.recall)} federated. `}
              Personalized anomalies are the hard ones — the drift score alone catches{' '}
              {ev.by_type.personalized_anomaly.drift_only.caught}/{ev.by_type.personalized_anomaly.drift_only.total} of them, so how much
              weight fusion gives drift (α) matters. Explore it below.
            </span>
          </div>
        </Card>

        {/* Confusion matrices */}
        <Card className="p-6">
          <CardHeader title="Confusion matrices" subtitle="Rows = truth, columns = prediction" />
          <div className="grid gap-4 sm:grid-cols-3">
            {MODELS.map((mod) => <Confusion key={mod.key} title={mod.short} color={mod.color} r={m[mod.key]} />)}
          </div>
          <div className="mt-6 space-y-2.5">
            <Delta label="Frauds missed" from={{ name: 'Local-only', v: m.local.fn }} to={{ name: 'Federated', v: m.federated.fn }} />
            <Delta label="False alarms" from={{ name: 'Federated', v: m.federated.fp }} to={{ name: 'Fed + drift', v: m.fused.fp }} />
            <Delta label="Frauds missed" from={{ name: 'Federated', v: m.federated.fn }} to={{ name: 'Fed + drift', v: m.fused.fn }} />
          </div>
        </Card>
      </div>

      {/* Alpha exploration */}
      <Card className="mt-5 p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <h3 className="text-[17px] font-semibold text-white">Tuning the fusion weight α</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
              α = 1 trusts only the global model; α = 0 trusts only personal drift. The project ships α = 0.7 — the README lists
              tuning α as future work. Drag the slider to explore it on the same held-out data.
            </p>
          </div>
          <div className="w-full max-w-sm">
            <div className="mb-2 flex justify-between text-[12px] tracking-wider text-slate-400"><span>Fusion weight α</span><span className="font-mono text-[15px] normal-case text-white">{alpha.toFixed(2)}</span></div>
            <Slider min={0} max={1} step={0.05} value={alpha} onChange={setAlpha} color={C.fuseSoft} aria-label="Alpha" />
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ['Precision', pct(live.precision)], ['Recall', pct(live.recall)], ['F1', live.f1.toFixed(3)],
            ['Frauds caught', `${live.tp}/${live.tp + live.fn}`], ['False alarms', live.fp],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-slate-500">{k}</div>
              <div className="mt-0.5 text-[20px] font-semibold text-white">{v}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div>
            <div className="mb-1 text-[14px] font-semibold text-white">Metrics vs α</div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <Legend items={[
                { label: 'Precision', color: METRIC_COLORS.precision, line: true },
                { label: 'Recall', color: METRIC_COLORS.recall, line: true },
                { label: 'F1', color: METRIC_COLORS.f1, line: true },
              ]} />
              <span className="text-[12px] text-slate-400">best F1 {best.f1.toFixed(3)} at α = {best.alpha.toFixed(2)}</span>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer>
                <LineChart data={ev.alpha_sweep} margin={{ top: 16, right: 16, left: -12, bottom: 4 }}>
                  <CartesianGrid stroke={C.grid} vertical={false} />
                  <XAxis dataKey="alpha" type="number" domain={[0, 1]} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]} {...chartAxis} />
                  <YAxis {...chartAxis} domain={[0.5, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                  <Tooltip content={<ChartTooltip labelFormatter={(l) => `α = ${Number(l).toFixed(2)}`} valueFormatter={(v) => pct(v)} />} />
                  <ReferenceLine x={0.7} stroke="#8b93a7" strokeDasharray="4 4" label={{ value: 'project α', fill: '#aab2c5', fontSize: 11, position: 'insideTopRight' }} />
                  <ReferenceLine x={alpha} stroke={C.fuseSoft} strokeWidth={2} />
                  <Line type="monotone" dataKey="precision" name="Precision" stroke={METRIC_COLORS.precision} strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="recall" name="Recall" stroke={METRIC_COLORS.recall} strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="f1" name="F1" stroke={METRIC_COLORS.f1} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <div className="mb-1 text-[14px] font-semibold text-white">Decision space</div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <Legend items={[{ label: 'Legitimate', color: C.neutral }, { label: 'Fraud', color: C.fraud }, { label: 'Decision boundary', color: C.fuseSoft, line: true }]} />
              <span className="text-[12px] text-slate-400">shaded = flagged as fraud</span>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 16, right: 16, left: -6, bottom: 18 }}>
                  <CartesianGrid stroke={C.grid} />
                  <XAxis type="number" dataKey="p" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} {...chartAxis}
                    label={{ value: 'Global model P', fill: C.axis, fontSize: 11, position: 'insideBottom', dy: 16 }} />
                  <YAxis type="number" dataKey="s" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} {...chartAxis}
                    label={{ value: 'Drift S', fill: C.axis, fontSize: 11, angle: -90, position: 'insideLeft', dx: 18 }} />
                  <ZAxis range={[28, 28]} />
                  <Customized component={(props) => <FraudRegion {...props} alpha={alpha} threshold={ev.threshold} />} />
                  <Tooltip cursor={false} content={<PointTooltip />} />
                  <Scatter data={ev.points.filter((p) => !p.y)} fill={C.neutral} fillOpacity={0.55} isAnimationActive={false} />
                  <Scatter data={ev.points.filter((p) => p.y)} fill={C.fraud} isAnimationActive={false}
                    shape={(pr) => <circle cx={pr.cx} cy={pr.cy} r={4.5} fill={C.fraud} stroke="#0f1524" strokeWidth={1.5} />} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

function Metric({ label, value, prev }) {
  const delta = prev != null ? value - prev : null
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-[22px] font-semibold text-white">{pct(value)}</span>
        {delta != null && Math.abs(delta) >= 0.0005 && (
          <span className={`text-[11.5px] font-medium ${delta > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {delta > 0 ? '▲' : '▼'} {(Math.abs(delta) * 100).toFixed(1)}
          </span>
        )}
      </div>
    </div>
  )
}

function Confusion({ title, color, r }) {
  const cells = [
    { label: 'TN', v: r.tn, good: true }, { label: 'FP', v: r.fp, good: false },
    { label: 'FN', v: r.fn, good: false }, { label: 'TP', v: r.tp, good: true },
  ]
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[12.5px] font-medium text-slate-200"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{title}</div>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-1 text-center text-[11px]">
        <span />
        <span className="text-slate-500">pred legit</span>
        <span className="text-slate-500">pred fraud</span>
        {[0, 1].map((row) => (
          <FragmentRow key={row} label={row === 0 ? 'legit' : 'fraud'} cells={cells.slice(row * 2, row * 2 + 2)} />
        ))}
      </div>
    </div>
  )
}

function FragmentRow({ label, cells }) {
  return (
    <>
      <span className="self-center pr-1 text-right text-slate-500">{label}</span>
      {cells.map((c) => (
        <div key={c.label} className={`rounded-lg px-2 py-2 ${c.good ? 'bg-emerald-400/[0.08]' : 'bg-rose-400/[0.10]'}`}>
          <div className="font-mono text-[15px] font-semibold text-white">{num(c.v)}</div>
          <div className="text-[10px] text-slate-500">{c.label}</div>
        </div>
      ))}
    </>
  )
}

function FraudRegion({ xAxisMap, yAxisMap, alpha, threshold }) {
  const xa = xAxisMap && Object.values(xAxisMap)[0]
  const ya = yAxisMap && Object.values(yAxisMap)[0]
  if (!xa || !ya) return null
  const X = (v) => xa.scale(v), Y = (v) => ya.scale(v)
  // polygon of {(p, s) in [0,1]^2 : alpha*p + (1-alpha)*s >= threshold}
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]]
  const f = ([p, s]) => alpha * p + (1 - alpha) * s - threshold
  const poly = []
  const line = []
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4]
    const fa = f(a), fb = f(b)
    if (fa >= 0) poly.push(a)
    if ((fa >= 0) !== (fb >= 0)) {
      const t = fa / (fa - fb)
      const pt = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
      poly.push(pt)
      line.push(pt)
    }
  }
  if (poly.length < 3) return null
  return (
    <g>
      <polygon points={poly.map(([p, s]) => `${X(p)},${Y(s)}`).join(' ')} fill={C.fraud} fillOpacity={0.07} />
      {line.length === 2 && (
        <line x1={X(line[0][0])} y1={Y(line[0][1])} x2={X(line[1][0])} y2={Y(line[1][1])} stroke={C.fuseSoft} strokeWidth={2} />
      )}
    </g>
  )
}

function PointTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl border border-white/10 bg-ink-900/95 px-3 py-2 text-[12px] shadow-2xl">
      <div className="mb-1 flex items-center gap-2 font-medium text-slate-100">
        <span className="font-mono">{d.user}</span> · {d.bank}
        <span className={`ml-auto rounded px-1.5 text-[10.5px] font-bold ${d.y ? 'bg-rose-500/20 text-rose-200' : 'bg-white/10 text-slate-300'}`}>{d.y ? 'FRAUD' : 'legit'}</span>
      </div>
      <div className="text-slate-400">{inr(d.amount)} · {pretty(d.merchant)} · {pretty(d.location)} · {String(d.hour).padStart(2, '0')}:00</div>
      <div className="mt-1 font-mono text-slate-300">P = {d.p.toFixed(3)} · S = {d.s.toFixed(3)}</div>
    </div>
  )
}
