import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDown, Brain, Building2, Fingerprint, Lightbulb, Loader2, Lock, ScanSearch, Sigma, Sparkles, Zap,
} from 'lucide-react'
import NeuralNet from '../components/NeuralNet'
import DriftBreakdown from '../components/DriftBreakdown'
import { Button, Card, ChipGroup, Field, PageHeader, ScoreTrack, Segmented, Slider, Verdict, WarmingUp } from '../components/ui'
import { api } from '../lib/api'
import { usePipeline } from '../lib/pipeline'
import { BANK_COLORS, C, DAYS, VOCAB, hourLabel, inr, pretty } from '../lib/theme'

export const PRESETS = [
  {
    id: 'a10k', title: 'User A · ₹10,000 electronics', sub: 'Low spender, big purchase',
    txn: { user_id: 'U001', amount: 10000, hour: 14, day_of_week: 2, merchant_category: 'Electronics', location: 'Hyderabad', transaction_type: 'POS', device_type: 'POS_Terminal' },
  },
  {
    id: 'b10k', title: 'User B · same ₹10,000', sub: 'High spender, routine',
    txn: { user_id: 'U002', amount: 10000, hour: 14, day_of_week: 2, merchant_category: 'Electronics', location: 'Hyderabad', transaction_type: 'POS', device_type: 'POS_Terminal' },
  },
  {
    id: 'night', title: 'User A · 2 AM overseas luxury', sub: 'Globally + personally suspicious',
    txn: { user_id: 'U001', amount: 15000, hour: 2, day_of_week: 4, merchant_category: 'Luxury_Goods', location: 'Overseas_Unknown', transaction_type: 'Online', device_type: 'Web_Browser' },
  },
  {
    id: 'grocery', title: 'User A · ₹520 groceries', sub: 'Everyday behaviour',
    txn: { user_id: 'U001', amount: 520, hour: 11, day_of_week: 1, merchant_category: 'Grocery', location: 'Hyderabad', transaction_type: 'POS', device_type: 'POS_Terminal' },
  },
]

const LOG_MIN = Math.log(50), LOG_MAX = Math.log(100000)
const toSlider = (a) => Math.round(((Math.log(a) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 1000)
const fromSlider = (v) => {
  const a = Math.exp(LOG_MIN + (v / 1000) * (LOG_MAX - LOG_MIN))
  if (a < 1000) return Math.round(a / 10) * 10
  if (a < 10000) return Math.round(a / 50) * 50
  return Math.round(a / 500) * 500
}

export default function Analyzer() {
  const { ready, status, modelVersion } = usePipeline()
  const [txn, setTxn] = useState(PRESETS[0].txn)
  const [alpha, setAlpha] = useState(0.7)
  const [threshold, setThreshold] = useState(0.5)
  const [users, setUsers] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [animKey, setAnimKey] = useState(0)
  const [activePreset, setActivePreset] = useState('a10k')
  const reqId = useRef(0)

  useEffect(() => {
    if (ready) api.users().then((d) => setUsers(d.banks)).catch(() => {})
  }, [ready])

  const score = useCallback(async (t, a, th, replay) => {
    const id = ++reqId.current
    setLoading(true)
    try {
      const r = await api.predict(t, a, th)
      if (id !== reqId.current) return
      setResult(r)
      if (replay) setAnimKey((k) => k + 1)
    } catch {
      /* keep previous */
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [])

  // live re-score while editing
  useEffect(() => {
    if (!ready) return
    const h = setTimeout(() => score(txn, alpha, threshold, false), 180)
    return () => clearTimeout(h)
  }, [txn, alpha, threshold, ready, modelVersion, score])

  const set = (k) => (v) => { setActivePreset(null); setTxn((t) => ({ ...t, [k]: v })) }
  const applyPreset = (p) => { setActivePreset(p.id); setTxn(p.txn); score(p.txn, alpha, threshold, true) }

  if (!ready) return <WarmingUp status={status} />

  const bank = users ? Object.entries(users).find(([, list]) => list.some((u) => u.user_id === txn.user_id))?.[0] : result?.txn?.bank_id

  return (
    <div>
      <PageHeader step={4} eyebrow="End-to-end inference" title="Live analyzer: watch a transaction get judged">
        Compose any transaction. It flows through the federated global model and the customer’s private behavioral profile,
        and the two scores are fused into one decision — computed live by <span className="font-mono text-slate-300">BehavioralDriftPredictor</span>.
      </PageHeader>

      {/* Presets */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PRESETS.map((p) => (
          <button key={p.id} onClick={() => applyPreset(p)}
            className={`glass rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5 ${activePreset === p.id ? 'ring-1 ring-white/40' : ''}`}>
            <div className="flex items-center gap-2 text-[13.5px] font-semibold text-white"><Sparkles size={14} className="text-amber-300" />{p.title}</div>
            <div className="mt-0.5 text-[12px] text-slate-400">{p.sub}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* Composer */}
        <Card className="h-fit space-y-5 p-5 xl:sticky xl:top-4">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-white"><ScanSearch size={17} /> Compose transaction</div>

          <Field label="Customer" right={bank && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: BANK_COLORS[bank] }} />{bank}</span>}>
            <select value={txn.user_id} onChange={(e) => set('user_id')(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-[13.5px] text-slate-100 outline-none focus:border-white/30">
              {users && Object.entries(users).map(([b, list]) => (
                <optgroup key={b} label={b}>
                  {list.map((u) => <option key={u.user_id} value={u.user_id}>{u.user_id}{u.label ? ` — ${u.label}` : ` — avg ${inr(u.avg_amount)}`}</option>)}
                </optgroup>
              ))}
              {!users && <option value={txn.user_id}>{txn.user_id}</option>}
            </select>
          </Field>

          <Field label="Amount" right={inr(txn.amount)}>
            <Slider min={0} max={1000} value={toSlider(txn.amount)} onChange={(v) => set('amount')(fromSlider(v))} color={C.fuseSoft} aria-label="Amount" />
            <div className="mt-2 flex items-center gap-2">
              <span className="text-slate-500">₹</span>
              <input type="number" min={1} value={txn.amount} onChange={(e) => set('amount')(Math.max(1, Number(e.target.value) || 1))}
                className="w-full rounded-lg border border-white/10 bg-ink-900 px-2.5 py-1.5 font-mono text-[13px] text-slate-100 outline-none focus:border-white/30" />
            </div>
          </Field>

          <Field label="Time of day" right={hourLabel(txn.hour)}>
            <Slider min={0} max={23} value={txn.hour} onChange={set('hour')} color={C.fuseSoft} aria-label="Hour" />
          </Field>

          <Field label="Day of week">
            <Segmented options={DAYS.map((d, i) => ({ value: i, label: d }))} value={txn.day_of_week} onChange={set('day_of_week')} />
          </Field>

          <Field label="Merchant"><ChipGroup options={VOCAB.merchant_category} value={txn.merchant_category} onChange={set('merchant_category')} format={pretty} color={C.fuseSoft} /></Field>
          <Field label="Location"><ChipGroup options={VOCAB.location} value={txn.location} onChange={set('location')} format={pretty} color={C.fuseSoft} /></Field>
          <Field label="Type"><ChipGroup options={VOCAB.transaction_type} value={txn.transaction_type} onChange={set('transaction_type')} format={pretty} color={C.fuseSoft} /></Field>
          <Field label="Device"><ChipGroup options={VOCAB.device_type} value={txn.device_type} onChange={set('device_type')} format={pretty} color={C.fuseSoft} /></Field>

          <Button className="w-full" icon={Zap} loading={loading} onClick={() => score(txn, alpha, threshold, true)}>Analyze transaction</Button>
        </Card>

        {/* Pipeline */}
        <div className="min-w-0">
          {!result ? (
            <Card className="grid h-[400px] place-items-center text-slate-400"><Loader2 className="animate-spin" /></Card>
          ) : (
            <Pipeline r={result} animKey={animKey} alpha={alpha} setAlpha={setAlpha} threshold={threshold} setThreshold={setThreshold} loading={loading} />
          )}
        </div>
      </div>
    </div>
  )
}

function Connector({ split }) {
  return (
    <div className="relative flex h-9 justify-center">
      {split ? (
        <svg viewBox="0 0 400 36" preserveAspectRatio="none" className="h-full w-1/2">
          <path d="M200,0 L200,12 M200,12 C200,24 100,18 100,36 M200,12 C200,24 300,18 300,36" fill="none" stroke="#2a3349" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <path d="M200,0 L200,12 C200,24 100,18 100,36" fill="none" stroke={C.fl} strokeWidth="2" className="dash-flow" vectorEffect="non-scaling-stroke" />
          <path d="M200,12 C200,24 300,18 300,36" fill="none" stroke={C.drift} strokeWidth="2" className="dash-flow" vectorEffect="non-scaling-stroke" />
        </svg>
      ) : (
        <div className="flex flex-col items-center text-slate-600"><div className="h-6 w-px bg-white/15" /><ArrowDown size={12} /></div>
      )}
    </div>
  )
}

function Pipeline({ r, animKey, alpha, setAlpha, threshold, setThreshold, loading }) {
  const t = r.txn
  const P = r.global_fraud_probability, S = r.behavioral_drift_score, F = r.final_fraud_score
  const flOnly = P >= threshold ? 'FRAUD' : 'LEGITIMATE'
  const bankColor = BANK_COLORS[t.bank_id]
  const hot = r.features.filter((f) => f.name.includes('_') && !['amount_log', 'hour_norm', 'day_of_week_norm'].includes(f.name) && f.value === 1)
  const stage = (i) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.35, duration: 0.4 } })

  return (
    <div className={`transition-opacity ${loading ? 'opacity-80' : ''}`}>
      {/* Txn */}
      <motion.div key={`txn-${animKey}`} {...stage(0)}>
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Incoming transaction</div>
              <div className="text-[28px] font-semibold leading-tight text-white">{inr(t.amount)}</div>
            </div>
            <div className="flex flex-wrap gap-2 text-[12.5px]">
              {[
                ['Customer', <span className="inline-flex items-center gap-1.5 font-mono"><span className="h-2 w-2 rounded-full" style={{ background: bankColor }} />{t.user_id} @ {t.bank_id}</span>],
                ['Time', `${hourLabel(t.hour)}, ${DAYS[t.day_of_week]}`],
                ['Merchant', pretty(t.merchant_category)],
                ['Location', pretty(t.location)],
                ['Type', `${pretty(t.transaction_type)} · ${pretty(t.device_type)}`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5">
                  <div className="text-[10.5px] uppercase tracking-wider text-slate-500">{k}</div>
                  <div className="text-slate-100">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>

      <Connector split />

      {/* Lanes */}
      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div key={`fl-${animKey}`} {...stage(1)}>
          <Card className="h-full p-5" glow={C.fl}>
            <LaneHeader icon={Brain} color={C.fl} title="Global FL model" sub="Shared knowledge from all 3 banks (FedAvg)" />
            <div className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">What the model sees · 26-dim encoding</div>
            <div className="mb-3 flex flex-wrap gap-1.5 font-mono text-[11px]">
              {r.features.slice(0, 3).map((f) => (
                <span key={f.name} className="rounded-md bg-sky-400/10 px-1.5 py-0.5 text-sky-100 ring-1 ring-sky-400/20">{f.name}={f.value.toFixed(2)}</span>
              ))}
              {hot.map((f) => (
                <span key={f.name} className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-slate-300 ring-1 ring-white/10">{f.name}</span>
              ))}
            </div>
            <NeuralNet features={r.features} activations={r.activations} prob={P} animKey={animKey} />
            <LaneOutput label="Fraud probability" symbol="P" value={P} color={C.fl} note="Same answer for every customer — the model has no idea who is spending." />
          </Card>
        </motion.div>

        <motion.div key={`bd-${animKey}`} {...stage(1.4)}>
          <Card className="h-full p-5" glow={C.drift}>
            <LaneHeader icon={Fingerprint} color={C.drift} title="Behavioral drift" sub={<span className="inline-flex items-center gap-1"><Lock size={11} className="text-emerald-300" />{t.user_id}’s private profile, computed inside {t.bank_id}</span>} />
            {!r.known_user && <div className="mb-3 rounded-lg bg-amber-400/10 px-3 py-2 text-[12px] text-amber-200">Unknown customer — falling back to a generic default profile.</div>}
            <DriftBreakdown result={r} animKey={animKey} delay={0.6} />
            <LaneOutput label="Drift score" symbol="S" value={S} color={C.drift} note="Weighted sum: 0.40·amount + 0.20·time + 0.20·merchant + 0.10·location + 0.10·type" />
          </Card>
        </motion.div>
      </div>

      <Connector />

      {/* Fusion */}
      <motion.div key={`fu-${animKey}`} {...stage(2.4)}>
        <Card className="p-5" glow={C.fuse}>
          <LaneHeader icon={Sigma} color={C.fuse} title="Score fusion" sub="S_final = α · P + (1 − α) · S" />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[18px] text-slate-300">
            <span className="text-slate-100">{alpha.toFixed(2)}</span><span>×</span>
            <span className="rounded-md px-2 py-0.5 text-white" style={{ background: `${C.fl}30` }}>{P.toFixed(3)}</span>
            <span>+</span>
            <span className="text-slate-100">{(1 - alpha).toFixed(2)}</span><span>×</span>
            <span className="rounded-md px-2 py-0.5 text-white" style={{ background: `${C.drift}30` }}>{S.toFixed(3)}</span>
            <span>=</span>
            <span className="rounded-md px-2.5 py-0.5 text-[22px] font-semibold text-white" style={{ background: `${C.fuse}38` }}>{F.toFixed(3)}</span>
          </div>
          <div className="mt-4">
            <ScoreTrack threshold={threshold} segments={[{ value: alpha * P, color: C.fl }, { value: (1 - alpha) * S, color: C.drift }]} height={14} />
          </div>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <Field label={<><span className="normal-case">α</span> · trust in global model</>} right={alpha.toFixed(2)}>
              <Slider min={0} max={1} step={0.05} value={alpha} onChange={setAlpha} color={C.fuseSoft} aria-label="Alpha" />
              <div className="mt-1 flex justify-between text-[11px] text-slate-500"><span>0 · personal only</span><span>project default 0.70</span><span>1 · global only</span></div>
            </Field>
            <Field label="Decision threshold" right={threshold.toFixed(2)}>
              <Slider min={0.1} max={0.9} step={0.05} value={threshold} onChange={setThreshold} color={C.fuseSoft} aria-label="Threshold" />
              <div className="mt-1 flex justify-between text-[11px] text-slate-500"><span>stricter</span><span>default 0.50</span><span>looser</span></div>
            </Field>
          </div>
        </Card>
      </motion.div>

      <Connector />

      {/* Decision */}
      <motion.div key={`de-${animKey}`} {...stage(3.2)}>
        <Card className="overflow-hidden p-6" glow={r.decision === 'FRAUD' ? C.fraud : C.legit}>
          <div className="flex flex-wrap items-center gap-6">
            <Verdict decision={r.decision} />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] uppercase tracking-wider text-slate-500">Final fraud score {F.toFixed(3)} {F >= threshold ? '≥' : '<'} {threshold.toFixed(2)}</div>
              <p className="mt-1 text-[14.5px] leading-relaxed text-slate-200">{r.explanation.replace(/RS /g, '₹')}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <Compare label="Global model alone" score={P} decision={flOnly} threshold={threshold} color={C.fl} />
            <Compare label="Global + personal drift" score={F} decision={r.decision} threshold={threshold} color={C.fuse} />
          </div>
          <AnimatePresence>
            {flOnly !== r.decision && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-4 flex items-start gap-2 rounded-xl bg-amber-400/[0.08] px-4 py-3 text-[13.5px] text-amber-100 ring-1 ring-amber-300/25">
                <Lightbulb size={16} className="mt-0.5 shrink-0 text-amber-300" />
                {r.decision === 'FRAUD'
                  ? `The global model alone would have let this through. ${t.user_id}’s personal baseline is what caught it.`
                  : `The global model alone would have flagged this. ${t.user_id}’s personal history shows it is normal for them — a false alarm avoided.`}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </div>
  )
}

function LaneHeader({ icon: Icon, color, title, sub }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${color}26`, color }}><Icon size={18} /></div>
      <div>
        <div className="text-[15px] font-semibold text-white">{title}</div>
        <div className="text-[12px] text-slate-400">{sub}</div>
      </div>
    </div>
  )
}

function LaneOutput({ label, symbol, value, color, note }) {
  return (
    <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] uppercase tracking-wider text-slate-500">{label}</span>
        <span className="font-mono text-[24px] font-semibold text-white"><span className="text-[15px] text-slate-500">{symbol} = </span>{value.toFixed(3)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${value * 100}%` }} transition={{ duration: 0.7 }} />
      </div>
      <div className="mt-2 text-[11.5px] text-slate-500">{note}</div>
    </div>
  )
}

function Compare({ label, score, decision, threshold, color }) {
  const fraud = decision === 'FRAUD'
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
      <span className="h-8 w-1 rounded-full" style={{ background: color }} />
      <div className="flex-1">
        <div className="text-[12px] text-slate-400">{label}</div>
        <div className="font-mono text-[15px] text-white">{score.toFixed(3)} <span className="text-[12px] text-slate-500">{score >= threshold ? '≥' : '<'} {threshold.toFixed(2)}</span></div>
      </div>
      <span className={`rounded-lg px-2.5 py-1 text-[12px] font-bold ${fraud ? 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/40' : 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/40'}`}>{decision}</span>
    </div>
  )
}
