import { motion } from 'framer-motion'
import { Loader2, Lock, ShieldAlert, ShieldCheck } from 'lucide-react'
import { C } from '../lib/theme'

export function Card({ className = '', children, glow, ...rest }) {
  return (
    <div
      className={`glass relative rounded-2xl ${className}`}
      style={glow ? { boxShadow: `0 0 0 1px ${glow}33, 0 20px 60px -30px ${glow}66` } : undefined}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardHeader({ icon: Icon, title, subtitle, right, color }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div
            className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg"
            style={{ background: `${color || '#8b93a7'}1f`, color: color || '#cbd2e1' }}
          >
            <Icon size={16} />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-slate-100 leading-tight">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[12.5px] text-slate-400 leading-snug">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}

export function PageHeader({ step, eyebrow, title, children, right }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        <div className="mb-2 flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-slate-400">
          {step != null && (
            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-slate-300">
              STEP {step}
            </span>
          )}
          {eyebrow}
        </div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-white md:text-[32px]">{title}</h1>
        {children && <p className="mt-2 text-[15px] leading-relaxed text-slate-400">{children}</p>}
      </div>
      {right}
    </div>
  )
}

export function Stat({ label, value, hint, color, icon: Icon }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-wider text-slate-400">
        {Icon && <Icon size={13} style={{ color: color || undefined }} />}
        {label}
      </div>
      <div className="mt-1 text-[22px] font-semibold leading-tight text-white">{value}</div>
      {hint && <div className="mt-0.5 text-[12px] text-slate-500">{hint}</div>}
    </div>
  )
}

export function Pill({ children, color = '#8b93a7', className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium ${className}`}
      style={{ background: `${color}1c`, color: '#dfe4ee', boxShadow: `inset 0 0 0 1px ${color}40` }}
    >
      {children}
    </span>
  )
}

export function Dot({ color, size = 8, className = '' }) {
  return <span className={`inline-block shrink-0 rounded-full ${className}`} style={{ width: size, height: size, background: color }} />
}

export function Button({ children, variant = 'primary', className = '', icon: Icon, loading, ...rest }) {
  const styles = {
    primary: 'bg-white text-ink-950 hover:bg-slate-200 shadow-[0_8px_30px_-10px_rgba(255,255,255,0.45)]',
    ghost: 'bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] border border-white/[0.08]',
    subtle: 'text-slate-300 hover:text-white hover:bg-white/[0.05]',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : Icon && <Icon size={16} />}
      {children}
    </button>
  )
}

export function ChipGroup({ options, value, onChange, color = C.fl, format = (x) => x }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o === value
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-all ${
              active ? 'text-white' : 'text-slate-400 hover:text-slate-200 bg-white/[0.03] hover:bg-white/[0.06]'
            }`}
            style={active ? { background: `${color}2e`, boxShadow: `inset 0 0 0 1px ${color}` } : undefined}
          >
            {format(o)}
          </button>
        )
      })}
    </div>
  )
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-xl border border-white/[0.07] bg-white/[0.03] p-1">
      {options.map((o) => {
        const v = typeof o === 'object' ? o.value : o
        const label = typeof o === 'object' ? o.label : o
        const active = v === value
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`relative rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${active ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {active && <motion.span layoutId={`seg-${options.map((x) => (typeof x === 'object' ? x.value : x)).join()}`} className="absolute inset-0 rounded-lg bg-white/[0.09]" />}
            <span className="relative">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Slider({ value, min, max, step = 1, onChange, color = C.fl, ...rest }) {
  const fill = ((value - min) / (max - min)) * 100
  return (
    <input
      type="range"
      className="slider"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ '--fill': `${fill}%`, '--track-fill': color }}
      {...rest}
    />
  )
}

export function Field({ label, right, children }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[12px] font-medium uppercase tracking-wider text-slate-400">
        <span>{label}</span>
        {right && <span className="normal-case tracking-normal text-slate-200 font-mono text-[12.5px]">{right}</span>}
      </div>
      {children}
    </div>
  )
}

export function LockBadge({ children = 'Stays inside the bank' }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-400/[0.08] px-2 py-0.5 text-[11px] font-medium text-emerald-300/90 ring-1 ring-emerald-400/20">
      <Lock size={11} /> {children}
    </span>
  )
}

export function Verdict({ decision, size = 'lg' }) {
  const fraud = decision === 'FRAUD'
  const Icon = fraud ? ShieldAlert : ShieldCheck
  const color = fraud ? C.fraud : C.legit
  const big = size === 'lg'
  return (
    <motion.div
      key={decision}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      className={`relative inline-flex items-center gap-2.5 rounded-2xl font-bold tracking-wide ${big ? 'px-5 py-3 text-[22px]' : 'px-3 py-1.5 text-[13px]'}`}
      style={{ background: `${color}1f`, color: '#fff', boxShadow: `inset 0 0 0 1.5px ${color}, 0 0 40px -8px ${color}` }}
    >
      {big && <span className="absolute inset-0 rounded-2xl pulse-ring" style={{ boxShadow: `0 0 0 2px ${color}` }} />}
      <Icon size={big ? 26 : 15} style={{ color }} />
      {decision}
    </motion.div>
  )
}

/** Horizontal 0–1 track with a threshold marker. `segments` stack (e.g. P and S contributions). */
export function ScoreTrack({ value, threshold = 0.5, segments, color = C.fuse, height = 12, showScale = true }) {
  const segs = segments || [{ value, color }]
  return (
    <div>
      <div className="relative w-full rounded-full bg-white/[0.06]" style={{ height }}>
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          {segs.map((s, i) => (
            <motion.div
              key={i}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(0, Math.min(1, s.value)) * 100}%` }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.12 }}
              style={{ background: s.color, marginRight: i < segs.length - 1 ? 2 : 0 }}
              className="h-full first:rounded-l-full"
            />
          ))}
        </div>
        <div className="absolute -top-1.5 -bottom-1.5 w-[2px] rounded bg-white" style={{ left: `calc(${threshold * 100}% - 1px)` }} />
      </div>
      {showScale && (
        <div className="relative mt-1.5 h-4 text-[10.5px] text-slate-500 font-mono">
          <span className="absolute left-0">0</span>
          <span className="absolute -translate-x-1/2 text-slate-300" style={{ left: `${threshold * 100}%` }}>
            threshold {threshold.toFixed(2)}
          </span>
          <span className="absolute right-0">1</span>
        </div>
      )}
    </div>
  )
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
      <Loader2 size={18} className="animate-spin" /> {label}
    </div>
  )
}

export function WarmingUp({ status }) {
  return (
    <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
      <Loader2 size={28} className="mx-auto mb-4 animate-spin text-sky-300" />
      <h3 className="text-lg font-semibold text-white">Warming up the federated model…</h3>
      <p className="mt-2 text-sm text-slate-400">
        {status?.detail || 'The backend is generating data and training the global model with the project code.'} This
        takes a few seconds on first boot.
      </p>
      {status?.status === 'error' && <p className="mt-3 text-sm text-rose-300">{status.detail}</p>}
    </Card>
  )
}

export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter = (v) => v }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/10 bg-ink-900/95 px-3 py-2 text-[12px] shadow-2xl backdrop-blur">
      {label != null && <div className="mb-1 font-medium text-slate-200">{labelFormatter ? labelFormatter(label) : label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey || p.name} className="flex items-center gap-2 text-slate-300">
          <Dot color={p.color || p.payload?.fill} />
          <span className="text-slate-400">{p.name}</span>
          <span className="ml-auto pl-3 font-mono text-slate-100">{valueFormatter(p.value, p)}</span>
        </div>
      ))}
    </div>
  )
}

export function Legend({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-400">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          {it.line ? (
            <span className="inline-block h-[2px] w-4 rounded" style={{ background: it.color, opacity: it.dashed ? 0.9 : 1 }} />
          ) : (
            <Dot color={it.color} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  )
}
