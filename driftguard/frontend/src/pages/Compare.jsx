import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Brain, Fingerprint, Lightbulb, RotateCcw, Sigma } from 'lucide-react'
import DriftBreakdown from '../components/DriftBreakdown'
import { Button, Card, CardHeader, ChartTooltip, Legend, PageHeader, Slider, Verdict, WarmingUp, Loading } from '../components/ui'
import { api } from '../lib/api'
import { usePipeline } from '../lib/pipeline'
import { C, USER_COLORS, chartAxis, inr, inrShort, pretty } from '../lib/theme'

const BASE = { amount: 10000, hour: 14, day_of_week: 2, merchant_category: 'Electronics', location: 'Hyderabad', transaction_type: 'POS', device_type: 'POS_Terminal' }
const USERS = [
  { id: 'U001', name: 'User A', tag: 'Low spender · usually ₹300–₹800' },
  { id: 'U002', name: 'User B', tag: 'High spender · usually ₹8k–₹15k' },
]
const LOG_MIN = Math.log(500), LOG_MAX = Math.log(60000)
const toSlider = (a) => Math.round(((Math.log(a) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 1000)
const fromSlider = (v) => {
  const a = Math.exp(LOG_MIN + (v / 1000) * (LOG_MAX - LOG_MIN))
  return a < 10000 ? Math.round(a / 100) * 100 : Math.round(a / 500) * 500
}

export default function Compare() {
  const { ready, status, modelVersion } = usePipeline()
  const [amount, setAmount] = useState(10000)
  const [profiles, setProfiles] = useState({})
  const [results, setResults] = useState({})
  const [sweep, setSweep] = useState(null)

  useEffect(() => {
    if (!ready) return
    Promise.all(USERS.map((u) => api.profile(u.id))).then((ps) => setProfiles(Object.fromEntries(ps.map((p) => [p.user_id, p])))).catch(() => {})
    api.sweep(BASE, USERS.map((u) => u.id)).then(setSweep).catch(() => {})
  }, [ready, modelVersion])

  useEffect(() => {
    if (!ready) return
    const h = setTimeout(() => {
      Promise.all(USERS.map((u) => api.predict({ ...BASE, amount, user_id: u.id })))
        .then((rs) => setResults(Object.fromEntries(rs.map((r) => [r.txn.user_id, r])))).catch(() => {})
    }, 150)
    return () => clearTimeout(h)
  }, [amount, ready, modelVersion])

  const sweepData = useMemo(() => {
    if (!sweep) return []
    return sweep.U001.points.map((p, i) => ({ amount: p.amount, global: p.p, U001: p.final, U002: sweep.U002.points[i].final }))
  }, [sweep])

  if (!ready) return <WarmingUp status={status} />
  const ra = results.U001, rb = results.U002

  return (
    <div>
      <PageHeader step={5} eyebrow="Why personalization matters" title={<>Same purchase. Two customers. <span className="text-gradient">Two different verdicts.</span></>}>
        Both customers bank with Bank A and make the exact same {inr(amount)} electronics purchase at 2 PM in Hyderabad. The
        global model can’t tell them apart — their personal histories can.
      </PageHeader>

      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-center gap-5">
          <div className="min-w-[240px] flex-1">
            <div className="mb-2 flex items-center justify-between text-[12px] uppercase tracking-wider text-slate-400">
              <span>Purchase amount (applies to both)</span>
              <span className="font-mono text-[16px] normal-case tracking-normal text-white">{inr(amount)}</span>
            </div>
            <Slider min={0} max={1000} value={toSlider(amount)} onChange={(v) => setAmount(fromSlider(v))} color={C.fuseSoft} aria-label="Amount" />
          </div>
          <div className="flex flex-wrap gap-2 text-[12.5px] text-slate-300">
            {['Electronics', '14:00 · Wed', 'Hyderabad', 'POS terminal'].map((x) => <span key={x} className="rounded-lg bg-white/[0.05] px-2.5 py-1.5">{x}</span>)}
          </div>
          <Button variant="ghost" icon={RotateCcw} onClick={() => setAmount(10000)}>Reset to ₹10,000</Button>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {USERS.map((u) => (
          <UserColumn key={u.id} user={u} profile={profiles[u.id]} result={results[u.id]} amount={amount} />
        ))}
      </div>

      {ra && rb && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 grid gap-3 md:grid-cols-3">
          <Insight icon={Brain} color={C.fl} title="Global model" text={<>Identical input → identical P = <b className="font-mono text-white">{ra.global_fraud_probability.toFixed(3)}</b> for both.</>} />
          <Insight icon={Fingerprint} color={C.drift} title="Personal drift" text={<>User A <b className="font-mono text-white">{ra.behavioral_drift_score.toFixed(3)}</b> vs User B <b className="font-mono text-white">{rb.behavioral_drift_score.toFixed(3)}</b> — that gap is the personalization.</>} />
          <Insight icon={Sigma} color={C.fuse} title="Fused decision" text={<>User A → <b className="text-white">{ra.decision}</b> ({ra.final_fraud_score.toFixed(3)}), User B → <b className="text-white">{rb.decision}</b> ({rb.final_fraud_score.toFixed(3)}).</>} />
        </motion.div>
      )}

      <Card className="mt-5 p-6">
        <CardHeader title="Each customer gets their own alarm threshold"
          subtitle="Final fraud score as the purchase amount grows (everything else fixed). The global-only curve is shared; drift bends it per customer." />
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Legend items={[
            { label: 'User A · final score', color: USER_COLORS.U001, line: true },
            { label: 'User B · final score', color: USER_COLORS.U002, line: true },
            { label: 'Global model only (P)', color: '#8b93a7', line: true },
          ]} />
          {sweep && (
            <div className="flex gap-4 text-[12.5px] text-slate-300">
              <span>User A flagged from <b className="font-mono text-white">{inr(sweep.U001.flag_at)}</b></span>
              <span>User B flagged from <b className="font-mono text-white">{inr(sweep.U002.flag_at)}</b></span>
            </div>
          )}
        </div>
        <div className="h-[340px]">
          {!sweep ? <Loading /> : (
            <ResponsiveContainer>
              <LineChart data={sweepData} margin={{ top: 22, right: 20, left: -10, bottom: 4 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="amount" type="number" scale="log" domain={[100, 80000]} {...chartAxis}
                  ticks={[100, 300, 1000, 3000, 10000, 30000, 80000]} tickFormatter={inrShort} />
                <YAxis {...chartAxis} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} />
                <Tooltip content={<ChartTooltip labelFormatter={(l) => inr(l)} valueFormatter={(v) => v.toFixed(3)} />} />
                <ReferenceLine y={0.5} stroke="#f1f4fa" strokeOpacity={0.6} strokeDasharray="5 4" label={{ value: 'threshold 0.50', fill: '#cbd2e1', fontSize: 11, position: 'insideTopLeft' }} />
                <ReferenceLine x={amount} stroke={C.fuseSoft} strokeOpacity={0.7} label={{ value: inrShort(amount), fill: C.fuseSoft, fontSize: 11, position: 'top' }} />
                <Line type="monotone" dataKey="global" name="Global only" stroke="#8b93a7" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="U001" name="User A" stroke={USER_COLORS.U001} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="U002" name="User B" stroke={USER_COLORS.U002} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                {sweep.U001.flag_at && <ReferenceDot x={sweep.U001.flag_at} y={0.5} r={6} fill={USER_COLORS.U001} stroke="#0f1524" strokeWidth={2} />}
                {sweep.U002.flag_at && <ReferenceDot x={sweep.U002.flag_at} y={0.5} r={6} fill={USER_COLORS.U002} stroke="#0f1524" strokeWidth={2} />}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  )
}

function UserColumn({ user, profile, result, amount }) {
  const color = USER_COLORS[user.id]
  return (
    <Card className="p-6" glow={result ? (result.decision === 'FRAUD' ? C.fraud : C.legit) : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-10 w-1.5 rounded-full" style={{ background: color }} />
          <div>
            <div className="text-[20px] font-semibold text-white">{user.name} <span className="font-mono text-[14px] text-slate-500">{user.id}</span></div>
            <div className="text-[12.5px] text-slate-400">{user.tag}</div>
          </div>
        </div>
        {result && <Verdict decision={result.decision} size="sm" />}
      </div>

      {profile && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-[12px]">
          <div className="rounded-lg bg-white/[0.03] px-3 py-2"><div className="text-slate-500">Avg amount</div><div className="font-semibold text-white">{inr(profile.stats.amount_mean)}</div></div>
          <div className="rounded-lg bg-white/[0.03] px-3 py-2"><div className="text-slate-500">Std dev</div><div className="font-semibold text-white">{inr(profile.stats.amount_std)}</div></div>
          <div className="rounded-lg bg-white/[0.03] px-3 py-2"><div className="text-slate-500">Top merchant</div><div className="truncate font-semibold text-white">{pretty(profile.summary.common_merchants.split(', ')[0])}</div></div>
        </div>
      )}

      <div className="mt-5">
        <div className="mb-1 text-[11.5px] uppercase tracking-wider text-slate-500">Where this purchase sits in their history</div>
        {profile ? <AmountStrip history={profile.amount_history} mean={profile.stats.amount_mean} std={profile.stats.amount_std} amount={amount} color={color} z={result?.breakdown.z_amount} /> : <Loading />}
      </div>

      {result && (
        <>
          <div className="mt-5">
            <div className="mb-2 text-[11.5px] uppercase tracking-wider text-slate-500">Behavioral drift signals</div>
            <DriftBreakdown result={result} compact animKey={user.id} />
          </div>
          <div className="mt-5 space-y-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <ScoreRow label="Global model P" value={result.global_fraud_probability} color={C.fl} />
            <ScoreRow label="Behavioral drift S" value={result.behavioral_drift_score} color={C.drift} />
            <ScoreRow label="Final score" value={result.final_fraud_score} color={C.fuse} bold threshold={0.5} />
          </div>
        </>
      )}
    </Card>
  )
}

function ScoreRow({ label, value, color, bold, threshold }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`w-36 text-[12.5px] ${bold ? 'font-semibold text-white' : 'text-slate-400'}`}>{label}</span>
      <div className="relative h-2 flex-1 rounded-full bg-white/[0.06]">
        <motion.div className="h-full rounded-full" style={{ background: color }} animate={{ width: `${value * 100}%` }} transition={{ duration: 0.5 }} />
        {threshold != null && <div className="absolute -top-1 -bottom-1 w-[2px] bg-white" style={{ left: `${threshold * 100}%` }} />}
      </div>
      <span className={`w-12 text-right font-mono text-[13px] ${bold ? 'text-white' : 'text-slate-300'}`}>{value.toFixed(3)}</span>
    </div>
  )
}

/** Log-scale strip of a customer's past amounts with the test amount marked. */
function AmountStrip({ history, mean, std, amount, color, z }) {
  const W = 520, H = 118, padL = 12, padR = 12, lo = Math.log(100), hi = Math.log(100000)
  const x = (v) => padL + ((Math.log(Math.max(100, Math.min(100000, v))) - lo) / (hi - lo)) * (W - padL - padR)
  const jitter = (i) => 44 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 28
  const bandLo = Math.max(100, mean - 2 * std), bandHi = mean + 2 * std
  const mx = x(amount)
  const label = `${inr(amount)}${z != null ? `  ·  z = ${z}` : ''}`
  const pillW = label.length * 6.6 + 18
  const pillX = Math.min(Math.max(mx - pillW / 2, 2), W - pillW - 2) - mx
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
        <rect x={x(bandLo)} y={36} width={Math.max(2, x(bandHi) - x(bandLo))} height={44} rx="6" fill={color} fillOpacity="0.14" />
        <line x1={padL} x2={W - padR} y1={90} y2={90} stroke="#2a3349" />
        {[100, 1000, 10000, 100000].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={87} y2={93} stroke="#3a4560" />
            <text x={x(t)} y={110} textAnchor={t === 100 ? 'start' : t === 100000 ? 'end' : 'middle'} fontSize="11" fill={C.axis}>{inrShort(t)}</text>
          </g>
        ))}
        {history.map((v, i) => (
          <circle key={i} cx={x(v)} cy={jitter(i)} r="4" fill={color} fillOpacity="0.8" stroke="#0f1524" strokeWidth="1.5" />
        ))}
        <motion.g animate={{ x: mx }} initial={false} transition={{ type: 'spring', stiffness: 200, damping: 24 }}>
          <line x1={0} x2={0} y1={24} y2={92} stroke="#fff" strokeWidth="2.5" />
          <rect x={pillX} y={2} width={pillW} height={22} rx="7" fill="#f1f4fa" />
          <text x={pillX + pillW / 2} y={17} textAnchor="middle" fontSize="12" fontWeight="600" fill="#0a0f1b">{label}</text>
        </motion.g>
      </svg>
      <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-slate-500">
        <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: color, opacity: 0.35 }} />
        usual range (avg ± 2σ) · dots = past legitimate purchases
      </div>
    </div>
  )
}

function Insight({ icon: Icon, color, title, text }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
        <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `${color}26`, color }}><Icon size={14} /></span>{title}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{text}</p>
    </Card>
  )
}
