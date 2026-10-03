import { motion } from 'framer-motion'
import { Bar, BarChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Building2, Clock, FileSpreadsheet, Globe2, IndianRupee, Moon, UserRound } from 'lucide-react'
import { Card, CardHeader, ChartTooltip, Legend, Loading, LockBadge, PageHeader, Pill, WarmingUp } from '../components/ui'
import { usePipeline } from '../lib/pipeline'
import { BANKS, BANK_COLORS, C, chartAxis, hourLabel, inr, num, pct, pretty } from '../lib/theme'

export default function DataBanks() {
  const { overview, status, ready } = usePipeline()
  if (!ready && !overview) return <WarmingUp status={status} />
  if (!overview) return <Loading />

  const o = overview
  const totalLegit = o.total - o.fraud
  const amountPct = o.amount_dist.map((d) => ({
    bin: d.bin,
    legit: d.legit / totalLegit,
    fraud: d.fraud / o.fraud,
  }))

  return (
    <div>
      <PageHeader step={1} eyebrow="Data generation & partitioning" title="Synthetic transactions, split into isolated banks">
        The project’s generator creates {num(o.total)} transactions for {o.users} customers with persistent spending habits, then
        the partitioner hands each bank <span className="text-slate-200">only its own customers</span>. From here on, no bank can see
        another bank’s rows.
      </PageHeader>

      {/* Raw -> banks */}
      <Card className="p-6">
        <div className="grid items-center gap-6 lg:grid-cols-[280px_1fr_460px]">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/[0.06] text-slate-200"><FileSpreadsheet size={20} /></div>
              <div>
                <div className="text-[15px] font-semibold text-white">transactions_raw.csv</div>
                <div className="text-[12px] text-slate-400">generate_dataset.py · seed 42</div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-[12px]">
              <div><div className="text-slate-500">Rows</div><div className="text-[18px] font-semibold text-white">{num(o.total)}</div></div>
              <div><div className="text-slate-500">Size</div><div className="text-[18px] font-semibold text-white">{o.raw_size_kb} KB</div></div>
              <div><div className="text-slate-500">Customers</div><div className="text-[18px] font-semibold text-white">{o.users}</div></div>
              <div><div className="text-slate-500">Frauds</div><div className="text-[18px] font-semibold text-white">{o.fraud} <span className="text-[12px] font-normal text-slate-400">({pct(o.fraud_rate)})</span></div></div>
            </div>
          </motion.div>

          <div className="relative hidden h-full min-h-[260px] lg:block">
            <svg viewBox="0 0 200 300" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              {BANKS.map((b, i) => {
                const y = 50 + i * 100
                const d = `M0,150 C100,150 100,${y} 200,${y}`
                return (
                  <g key={b}>
                    <path d={d} fill="none" stroke="#2a3349" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    <path d={d} fill="none" stroke={BANK_COLORS[b]} strokeWidth="2" className="dash-flow" vectorEffect="non-scaling-stroke" />
                  </g>
                )
              })}
            </svg>
            <div className="absolute left-0 top-1/2 -translate-y-7 rounded-md bg-ink-900 px-1.5 py-0.5 font-mono text-[11px] text-slate-400 ring-1 ring-white/10">partition_banks.py</div>
          </div>

          <div className="space-y-3">
            {BANKS.map((b, i) => {
              const s = o.banks[b]
              return (
                <motion.div key={b} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.12 }}
                  className="rounded-xl border bg-ink-900/60 p-4" style={{ borderColor: `${BANK_COLORS[b]}55` }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${BANK_COLORS[b]}26`, color: BANK_COLORS[b] }}><Building2 size={16} /></div>
                      <div>
                        <div className="text-[14px] font-semibold text-white">{b}</div>
                        <div className="text-[11.5px] text-slate-500">data/{b.toLowerCase().replace(' ', '_')}/transactions.csv</div>
                      </div>
                    </div>
                    <LockBadge>Never leaves {b}</LockBadge>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-[12px]">
                    <div><div className="text-slate-500">Txns</div><div className="font-semibold text-white">{num(s.total_txns)}</div></div>
                    <div><div className="text-slate-500">Customers</div><div className="font-semibold text-white">{s.unique_users}</div></div>
                    <div><div className="text-slate-500">Frauds</div><div className="font-semibold text-white">{s.fraud_txns}</div></div>
                    <div><div className="text-slate-500">Avg amount</div><div className="font-semibold text-white">{inr(s.avg_amount)}</div></div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </Card>

      {/* Fraud types */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <CardHeader icon={Moon} color={C.fl} title="Global anomalies · ~40% of fraud"
            subtitle="Obvious to any model trained on enough data." />
          <div className="flex flex-wrap gap-2">
            <Pill color={C.fl}><IndianRupee size={12} />₹25k – ₹75k</Pill>
            <Pill color={C.fl}><Clock size={12} />1 AM – 4 AM</Pill>
            <Pill color={C.fl}><Globe2 size={12} />Overseas / unusual city</Pill>
            <Pill color={C.fl}>Jewelry · Luxury · Electronics</Pill>
          </div>
          <p className="mt-4 text-[13.5px] leading-relaxed text-slate-400">
            Huge, night-time, far from home. The <span className="text-slate-200">federated global model</span> learns these
            quickly because it sees examples from all three banks.
          </p>
        </Card>
        <Card className="p-6" glow={C.drift}>
          <CardHeader icon={UserRound} color={C.drift} title="Personalized anomalies · ~60% of fraud"
            subtitle="Look perfectly normal globally. Abnormal only for this customer." />
          <div className="flex flex-wrap gap-2">
            <Pill color={C.drift}><IndianRupee size={12} />4–8× the customer’s own average</Pill>
            <Pill color={C.drift}><Clock size={12} />10 AM – 6 PM</Pill>
            <Pill color={C.drift}>Home city (70%)</Pill>
            <Pill color={C.drift}>Electronics · Online retail · Dining</Pill>
          </div>
          <p className="mt-4 text-[13.5px] leading-relaxed text-slate-400">
            ₹4,000 at 2 PM in Hyderabad is unremarkable — unless the customer usually spends ₹550. Only the{' '}
            <span className="text-slate-200">personal behavioral profile</span> can catch this.
          </p>
        </Card>
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card className="p-6">
          <CardHeader title="When does fraud happen?" subtitle="Fraudulent transactions by hour of day (all banks)" />
          <div className="h-[260px]">
            <ResponsiveContainer>
              <BarChart data={o.hourly} margin={{ top: 22, right: 8, left: -18, bottom: 0 }} barCategoryGap={2}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <ReferenceArea x1={1} x2={5} fill={C.fl} fillOpacity={0.08} label={{ value: 'global anomalies', position: 'insideTop', fill: '#9cc6f7', fontSize: 11, dy: -18 }} />
                <ReferenceArea x1={10} x2={18} fill={C.drift} fillOpacity={0.08} label={{ value: 'personalized anomalies', position: 'insideTop', fill: '#ec93b4', fontSize: 11, dy: -18 }} />
                <XAxis dataKey="hour" {...chartAxis} tickFormatter={(h) => (h % 3 === 0 ? `${h}h` : '')} interval={0} />
                <YAxis {...chartAxis} allowDecimals={false} />
                <Tooltip content={<ChartTooltip labelFormatter={hourLabel} />} />
                <Bar dataKey="fraud" name="Fraud txns" fill={C.fraud} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader title="How much? Legit vs fraud amounts" subtitle="Share of each class per amount band — personalized fraud overlaps normal spending" />
          <div className="mb-2"><Legend items={[{ label: 'Legitimate (% of legit)', color: C.neutral }, { label: 'Fraud (% of fraud)', color: C.fraud }]} /></div>
          <div className="h-[236px]">
            <ResponsiveContainer>
              <BarChart data={amountPct} margin={{ top: 6, right: 8, left: -14, bottom: 0 }} barGap={2}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="bin" {...chartAxis} interval={0} tick={{ ...chartAxis.tick, fontSize: 10.5 }} />
                <YAxis {...chartAxis} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                <Tooltip content={<ChartTooltip labelFormatter={(l) => `₹ ${l}`} valueFormatter={(v) => pct(v)} />} />
                <Bar dataKey="legit" name="Legitimate" fill={C.neutral} radius={[4, 4, 0, 0]} />
                <Bar dataKey="fraud" name="Fraud" fill={C.fraud} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Sample */}
      <Card className="mt-6 p-6">
        <CardHeader title="What a transaction looks like" subtitle="A sample of the generated records — the same schema the model and profiles consume" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-slate-500">
                {['Transaction', 'User', 'Bank', 'Amount', 'Time', 'Merchant', 'Location', 'Type', 'Device', 'Label'].map((h) => (
                  <th key={h} className={`py-2.5 pr-4 font-medium ${h === 'Amount' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {o.sample.map((r) => (
                <tr key={r.transaction_id} className={`border-b border-white/[0.04] ${r.is_fraud ? 'bg-rose-500/[0.06]' : ''}`}>
                  <td className="py-2.5 pr-4 font-mono text-slate-400">{r.transaction_id}</td>
                  <td className="py-2.5 pr-4 font-mono text-slate-200">{r.user_id}</td>
                  <td className="py-2.5 pr-4"><span className="inline-flex items-center gap-1.5 text-slate-300"><span className="h-2 w-2 rounded-full" style={{ background: BANK_COLORS[r.bank_id] }} />{r.bank_id}</span></td>
                  <td className="num py-2.5 pr-4 text-right font-mono text-slate-100">{inr(r.amount, true)}</td>
                  <td className="py-2.5 pr-4 text-slate-300">{hourLabel(r.hour)}</td>
                  <td className="py-2.5 pr-4 text-slate-300">{pretty(r.merchant_category)}</td>
                  <td className="py-2.5 pr-4 text-slate-300">{pretty(r.location)}</td>
                  <td className="py-2.5 pr-4 text-slate-400">{pretty(r.transaction_type)}</td>
                  <td className="py-2.5 pr-4 text-slate-400">{pretty(r.device_type)}</td>
                  <td className="py-2.5 pr-4">
                    {r.is_fraud ? (
                      <span className="rounded-md bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-200 ring-1 ring-rose-400/40">FRAUD</span>
                    ) : (
                      <span className="text-[11px] text-slate-500">legit</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
