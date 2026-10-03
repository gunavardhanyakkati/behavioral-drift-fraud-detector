import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bar, BarChart, CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Building2, Clock, IndianRupee, MapPin, Search, ShoppingBag, Star, Fingerprint } from 'lucide-react'
import ClockChart from '../components/ClockChart'
import { Card, CardHeader, ChartTooltip, Loading, LockBadge, PageHeader, Segmented, WarmingUp } from '../components/ui'
import { api } from '../lib/api'
import { usePipeline } from '../lib/pipeline'
import { BANKS, BANK_COLORS, C, chartAxis, hourLabel, inr, inrShort, pct, pretty } from '../lib/theme'

export default function Profiles() {
  const { ready, status, modelVersion } = usePipeline()
  const [users, setUsers] = useState(null)
  const [bank, setBank] = useState('Bank A')
  const [userId, setUserId] = useState('U001')
  const [query, setQuery] = useState('')
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (ready) api.users().then((d) => setUsers(d.banks)).catch(() => {})
  }, [ready, modelVersion])

  useEffect(() => {
    if (!ready) return
    api.profile(userId).then(setProfile).catch(() => {})
  }, [userId, ready, modelVersion])

  if (!ready) return <WarmingUp status={status} />

  const list = (users?.[bank] || []).filter((u) => u.user_id.toLowerCase().includes(query.toLowerCase()))

  return (
    <div>
      <PageHeader step={3} eyebrow="Local behavioral profiling" title="Every bank learns each customer’s normal">
        Inside each bank, <span className="font-mono text-slate-300">LocalBehavioralProfileManager</span> builds a profile per customer from
        their legitimate history: typical amount, active hours, favourite merchants, usual places. These profiles are the
        yardstick for drift — and they never leave the bank.
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Picker */}
        <Card className="flex flex-col p-4 lg:sticky lg:top-4 lg:h-[calc(100vh-140px)]">
          <Segmented options={BANKS.map((b) => ({ value: b, label: b }))} value={bank} onChange={setBank} />
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
            <Search size={14} className="text-slate-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search user ID…"
              className="w-full bg-transparent text-[13px] text-slate-200 placeholder:text-slate-600 outline-none" />
          </div>
          <div className="mt-3 flex-1 space-y-1 overflow-y-auto pr-1">
            {!users && <Loading />}
            {list.map((u) => {
              const active = u.user_id === userId
              return (
                <button key={u.user_id} onClick={() => setUserId(u.user_id)}
                  className={`w-full rounded-xl px-3 py-2 text-left transition-colors ${active ? 'bg-white/[0.08] ring-1 ring-white/15' : 'hover:bg-white/[0.04]'}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] text-slate-100">{u.user_id}</span>
                    {u.label && <Star size={12} className="fill-amber-300/80 text-amber-300/80" />}
                    <span className="ml-auto font-mono text-[11.5px] text-slate-400">{inr(u.avg_amount)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-slate-500">
                    {u.label ? <span className="truncate text-amber-200/80">{u.label}</span> : <span>{u.txns} txns · {u.frauds} fraud</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </Card>

        {/* Detail */}
        <div className="min-w-0">
          {!profile ? <Loading /> : <ProfileDetail p={profile} />}
        </div>
      </div>
    </div>
  )
}

function ProfileDetail({ p }) {
  const s = p.stats
  const color = BANK_COLORS[p.bank_id]

  const hist = useMemo(() => {
    const a = p.amount_history
    if (!a.length) return []
    const min = Math.min(...a), max = Math.max(...a)
    const n = 14
    const w = (max - min) / n || 1
    const bins = Array.from({ length: n }, (_, i) => ({ x0: min + i * w, x1: min + (i + 1) * w, count: 0 }))
    a.forEach((v) => { bins[Math.min(n - 1, Math.floor((v - min) / w))].count++ })
    return bins.map((b) => ({ ...b, mid: (b.x0 + b.x1) / 2 }))
  }, [p])

  const freq = (counts) => {
    const total = Object.values(counts).reduce((x, y) => x + y, 0) || 1
    return Object.entries(counts).map(([name, c]) => ({ name: pretty(name), share: c / total, count: c }))
  }

  const binW = hist.length ? hist[0].x1 - hist[0].x0 : 1

  return (
    <motion.div key={p.user_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <Card className="p-6" glow={color}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl text-[18px] font-semibold text-white" style={{ background: `linear-gradient(135deg, ${color}, ${C.drift})` }}>
              <Fingerprint size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-[24px] font-semibold text-white">{p.user_id}</h2>
                <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] text-slate-200" style={{ background: `${color}22` }}>
                  <Building2 size={12} style={{ color }} />{p.bank_id}
                </span>
              </div>
              <div className="text-[13px] text-slate-400">{p.label || 'Customer profile'} · built from {s.total_txns} legitimate transactions</div>
            </div>
          </div>
          <LockBadge>Profile stored only in {p.bank_id}</LockBadge>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile icon={IndianRupee} label="Average amount" value={inr(s.amount_mean)} hint={`σ ${inr(s.amount_std)} · median ${inr(s.amount_median)}`} />
          <Tile icon={Clock} label="Typical hours" value={p.summary.typical_hours} hint={`mean ${s.hour_mean.toFixed(1)}h ± ${s.hour_std.toFixed(1)}h`} />
          <Tile icon={ShoppingBag} label="Top merchants" value={pretty(p.summary.common_merchants.split(', ')[0])} hint={p.summary.common_merchants.split(', ').slice(1).map(pretty).join(', ')} />
          <Tile icon={MapPin} label="Home location" value={pretty(p.summary.common_locations.split(', ')[0])} hint={p.summary.common_locations.split(', ').slice(1).map(pretty).join(', ') || '—'} />
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="p-6">
          <CardHeader title="Spending amounts" subtitle="Histogram of this customer’s legitimate amounts · shaded band = mean ± 1σ" />
          <div className="h-[240px]">
            <ResponsiveContainer>
              <BarChart data={hist} margin={{ top: 18, right: 8, left: -18, bottom: 0 }} barCategoryGap={2}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="mid" type="number" domain={[hist[0]?.x0, hist[hist.length - 1]?.x1]} {...chartAxis} tickFormatter={inrShort} />
                <YAxis {...chartAxis} allowDecimals={false} />
                <ReferenceArea x1={s.amount_mean - s.amount_std} x2={s.amount_mean + s.amount_std} fill={C.drift} fillOpacity={0.1} ifOverflow="hidden" />
                <ReferenceLine x={s.amount_mean} stroke={C.driftSoft} strokeWidth={2} label={{ value: `avg ${inr(s.amount_mean)}`, fill: '#f1f4fa', fontSize: 11, position: 'top' }} />
                <Tooltip content={({ active, payload }) => active && payload?.length ? (
                  <ChartTooltip active payload={[{ name: 'Transactions', value: payload[0].payload.count, color: C.drift }]}
                    label={`${inr(payload[0].payload.x0)} – ${inr(payload[0].payload.x1)}`} />
                ) : null} />
                <Bar dataKey="count" fill={C.drift} radius={[4, 4, 0, 0]} barSize={Math.max(6, 520 / Math.max(hist.length, 1) - 6)} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[12px] text-slate-500">Drift uses z = |amount − avg| / max(σ, ₹50); bin width {inr(binW)}.</p>
        </Card>

        <Card className="p-6">
          <CardHeader icon={Clock} color={C.drift} title="Active hours" subtitle="When this customer transacts · arc = typical window" />
          <div className="flex justify-center">
            <ClockChart hours={p.hour_history} mean={s.hour_mean} std={s.hour_std} />
          </div>
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <FreqCard title="Merchant categories" data={freq(p.merchant_counts)} threshold={0.15} rule="≥15% common → 0 · rare → 0.4 · never → 1.0" />
        <FreqCard title="Locations" data={freq(p.location_counts)} threshold={0.2} rule="≥20% home → 0 · rare → 0.5 · new → 0.95" />
        <FreqCard title="Transaction types" data={freq(p.tx_type_counts)} threshold={0.2} rule="≥20% usual → 0 · rare → 0.5 · new → 0.8" />
      </div>

      <Card className="p-6">
        <CardHeader title="Recent transactions" subtitle="Fraud rows are excluded when the profile is fitted — the baseline only learns genuine behaviour" />
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full min-w-[640px] text-left text-[12.5px]">
            <thead className="sticky top-0 bg-ink-850">
              <tr className="border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-slate-500">
                {['When', 'Amount', 'Merchant', 'Location', 'Type', 'Label'].map((h) => (
                  <th key={h} className={`py-2 pr-4 font-medium ${h === 'Amount' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.transactions.map((t) => (
                <tr key={t.transaction_id} className={`border-b border-white/[0.04] ${t.is_fraud ? 'bg-rose-500/[0.07]' : ''}`}>
                  <td className="py-2 pr-4 text-slate-400">{t.timestamp.slice(0, 10)} · {hourLabel(t.hour)}</td>
                  <td className="num py-2 pr-4 text-right font-mono text-slate-100">{inr(t.amount, true)}</td>
                  <td className="py-2 pr-4 text-slate-300">{pretty(t.merchant_category)}</td>
                  <td className="py-2 pr-4 text-slate-300">{pretty(t.location)}</td>
                  <td className="py-2 pr-4 text-slate-400">{pretty(t.transaction_type)}</td>
                  <td className="py-2 pr-4">{t.is_fraud
                    ? <span className="rounded-md bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-200 ring-1 ring-rose-400/40">FRAUD</span>
                    : <span className="text-[11px] text-slate-500">legit</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </motion.div>
  )
}

function Tile({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500"><Icon size={12} />{label}</div>
      <div className="mt-1 truncate text-[18px] font-semibold text-white">{value}</div>
      <div className="truncate text-[11.5px] text-slate-500">{hint}</div>
    </div>
  )
}

function FreqCard({ title, data, threshold, rule }) {
  const h = Math.max(120, data.length * 30 + 30)
  return (
    <Card className="p-5">
      <CardHeader title={title} subtitle={`Share of history · line = ${Math.round(threshold * 100)}% threshold`} />
      <div style={{ height: h }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 34, left: 0, bottom: 0 }} barCategoryGap={4}>
            <CartesianGrid stroke={C.grid} horizontal={false} />
            <XAxis type="number" domain={[0, 1]} {...chartAxis} tickFormatter={(v) => `${Math.round(v * 100)}%`} hide />
            <YAxis type="category" dataKey="name" {...chartAxis} width={92} tick={{ ...chartAxis.tick, fill: '#cbd2e1' }} axisLine={false} />
            <ReferenceLine x={threshold} stroke="#f1f4fa" strokeDasharray="3 3" strokeOpacity={0.7} />
            <Tooltip content={<ChartTooltip valueFormatter={(v) => pct(v)} />} />
            <Bar dataKey="share" name="Share" fill={C.drift} radius={[0, 4, 4, 0]} barSize={14}
              label={{ position: 'right', fill: '#aab2c5', fontSize: 11, formatter: (v) => `${Math.round(v * 100)}%` }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11.5px] text-slate-500">Drift rule: {rule}</p>
    </Card>
  )
}
